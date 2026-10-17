import { Copy, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { useCreateToken, useDeleteToken, useTokens } from "../api/tokenApi.ts";

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Скопировано"),
    () => toast.error("Не получилось скопировать — выдели и скопируй вручную"),
  );
}

/**
 * Личный токен и инструкция для команды iOS «Команды»: скриншот → текст → в «Входящие».
 * Названия действий — английские: русские названия в «Командах» не сверены (найти поиском: «снимок», «текст», «URL»).
 */
export function ShortcutSetup() {
  const { data: tokens } = useTokens();
  const create = useCreateToken();
  const remove = useDeleteToken();
  const [fresh, setFresh] = useState<string | null>(null);
  const inboxUrl = `${window.location.origin}/api/inbox`;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        Команда iOS «Команды» делает скриншот (например, карточки Duolingo с
        ответом), распознаёт на нём текст и отправляет сюда — слова появятся во
        «Входящих» на странице «Слова».
      </p>

      {fresh ? (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
          <p className="font-medium">
            Токен (показывается один раз — сохрани в команде):
          </p>
          <code className="break-all text-xs">{fresh}</code>
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => copy(fresh)}
          >
            <Copy />
            Скопировать токен
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="self-start"
          disabled={create.isPending}
          onClick={() => create.mutate(undefined, { onSuccess: setFresh })}
        >
          <KeyRound />
          Создать токен
        </Button>
      )}

      {tokens && tokens.length > 0 && (
        <ul className="flex flex-col gap-1">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">
                {t.prefix}… · создан{" "}
                {new Date(t.createdAt).toLocaleDateString("ru")}
                {t.lastUsedAt &&
                  ` · использован ${new Date(t.lastUsedAt).toLocaleDateString("ru")}`}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Удалить токен ${t.prefix}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(t.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">
          Как собрать команду
        </summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
          <li>
            «Команды» → «+» (новая команда). Добавь действие{" "}
            <b>Take Screenshot</b>.
          </li>
          <li>
            Действие <b>Extract Text from Image</b> — из скриншота.
          </li>
          <li>
            Действие <b>Get Contents of URL</b>: адрес{" "}
            <code className="break-all">{inboxUrl}</code>{" "}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-1"
              aria-label="Скопировать адрес"
              onClick={() => copy(inboxUrl)}
            >
              <Copy />
            </Button>
            , метод POST, заголовок <code>Authorization</code> ={" "}
            <code>Bearer &lt;токен&gt;</code>, тело — JSON с полем{" "}
            <code>text</code> = текст из шага 2.
          </li>
          <li>
            Запускать удобно кнопкой действия (iPhone 15 Pro и новее) или
            двойным касанием задней панели (Настройки → Универсальный доступ →
            Касание).
          </li>
        </ol>
        <p className="mt-2 text-muted-foreground text-xs">
          Названия действий даны по-английски: русские названия в «Командах» я
          не сверил — в русском интерфейсе ищи действие поиском по словам
          «снимок», «текст», «URL». Для выделенного текста подойдёт та же
          команда без первых двух шагов, с включённым «Показывать в меню
          „Поделиться“».
        </p>
      </details>
    </div>
  );
}
