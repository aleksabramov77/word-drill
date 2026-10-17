import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import {
  PermissionDeniedError,
  useDeviceSubscribed,
  usePushConfig,
  useSubscribe,
  useTestPush,
  useUnsubscribe,
} from "../api/pushApi.ts";
import { detectPushSupport } from "../model/support.ts";

export function PushSettings() {
  const support = detectPushSupport();
  const { data: config } = usePushConfig();
  const { data: subscribed } = useDeviceSubscribed();
  const subscribe = useSubscribe();
  const unsubscribe = useUnsubscribe();
  const test = useTestPush();

  if (support === "install-first") {
    return (
      <p className="text-sm">
        На iPhone уведомления приходят только приложению с экрана «Домой».
        Открой этот сайт в Safari, нажми «Поделиться» (в iOS 26 она может быть в
        меню «•••») → «На экран „Домой“», затем открой Word Drill с экрана
        «Домой» и вернись сюда.
      </p>
    );
  }
  if (support === "unsupported") {
    return (
      <p className="text-muted-foreground text-sm">
        Этот браузер не умеет получать уведомления от сайтов.
      </p>
    );
  }
  if (config && !config.enabled) {
    return (
      <p className="text-muted-foreground text-sm">
        Уведомления на сервере пока не настроены.
      </p>
    );
  }

  const enable = () =>
    config?.publicKey &&
    subscribe.mutate(config.publicKey, {
      onSuccess: () => toast.success("Уведомления включены"),
      onError: (error) =>
        toast.error(
          error instanceof PermissionDeniedError
            ? "Уведомления запрещены. Разреши их в настройках браузера или телефона."
            : "Не получилось включить уведомления",
        ),
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {subscribed
          ? "На этом устройстве уведомления включены."
          : "Включи, чтобы слова сами приходили в течение дня."}
      </p>
      <div className="flex flex-wrap gap-2">
        {subscribed ? (
          <>
            <Button
              variant="outline"
              disabled={test.isPending}
              onClick={() =>
                test.mutate(undefined, {
                  onSuccess: ({ delivered }) =>
                    delivered > 0
                      ? toast.success("Отправлено — смотри уведомление")
                      : toast.error("Не доставлено ни на одно устройство"),
                })
              }
            >
              <Send />
              Прислать тестовое
            </Button>
            <Button
              variant="ghost"
              disabled={unsubscribe.isPending}
              onClick={() => unsubscribe.mutate()}
            >
              <BellOff />
              Выключить
            </Button>
          </>
        ) : (
          <Button disabled={subscribe.isPending || !config} onClick={enable}>
            <Bell />
            Включить уведомления
          </Button>
        )}
      </div>
      {config && config.subscriptions > 0 && (
        <p className="text-muted-foreground text-xs">
          Устройств с уведомлениями: {config.subscriptions}
        </p>
      )}
    </div>
  );
}
