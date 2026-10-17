import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { APP_VERSION } from "@/shared/config";
import { Button } from "@/shared/ui/button";
import { useAppUpdate } from "../model/appUpdate.ts";

/** «Проверить обновление» — вместо «потянуть вниз», которого у приложения с экрана «Домой» нет. */
export function CheckUpdateButton() {
  const { checking, check } = useAppUpdate();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={checking}
      onClick={() =>
        check().then(
          (found) => {
            if (found) toast.success("Обновляю…");
            else toast.success(`У тебя последняя версия ${APP_VERSION}`);
          },
          () => toast.error("Не получилось проверить — нет связи?"),
        )
      }
    >
      <RefreshCw className={checking ? "animate-spin" : undefined} />
      {checking ? "Проверяю…" : "Проверить обновление"}
    </Button>
  );
}
