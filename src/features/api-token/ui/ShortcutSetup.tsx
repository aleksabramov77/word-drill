import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { logEvent } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { useCreateToken, useDeleteToken, useTokens } from "../api/tokenApi.ts";

/** Готовая команда (scripts/build-shortcut.ts); при установке iPhone спрашивает ключ. */
const SHORTCUT_URL = "/word-drill.shortcut";
/** Когда открывали файл команды — при следующем запуске приложение пишет это в журнал (src/app/index.tsx). */
export const SHORTCUT_OPENED_KEY = "wd-shortcut-opened-at";

function openShortcut(via: "same" | "window") {
  logEvent("shortcut-open", { via });
  try {
    localStorage.setItem(SHORTCUT_OPENED_KEY, String(Date.now()));
  } catch {
    // без localStorage просто не узнаем, вернулся ли
  }
}

/**
 * Команда iPhone «скриншот → Word Drill» в два шага: скопировать ключ, открыть файл команды.
 * - Ключ один: новый заменяет прежний (server/auth/tokens.ts).
 * - Ключ кладётся в буфер через ClipboardItem с обещанием: Safari разрешает запись в буфер только
 *   прямо по нажатию, а ключ приходит с сервера чуть позже.
 * - Файл открывается в том же окне — так iPhone показывает «Open in “Shortcuts”» (проверено). Минус:
 *   у этого экрана в приложении с экрана «Домой» нет «Назад» — выйти можно, только закрыв приложение.
 *   Отдельное окно (target=_blank) на iPhone зависало на белом экране — оно запасное.
 * - Нажатия и итог копирования — в журнал (server/log.ts): по нему видно, что сработало на телефоне.
 */
export function ShortcutSetup() {
  const { data: tokens } = useTokens();
  const create = useCreateToken();
  const remove = useDeleteToken();
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const key = tokens?.[0];

  const copyKey = async () => {
    const token = create.mutateAsync();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": token.then(
            (t) => new Blob([t], { type: "text/plain" }),
          ),
        }),
      ]);
      await token;
      setCopied(true);
      setShown(null);
      logEvent("shortcut-copy-key", { ok: true });
    } catch (error) {
      // Буфер недоступен — покажем ключ, его можно выделить и скопировать.
      try {
        setShown(await token);
        logEvent("shortcut-copy-key", { ok: false, error: String(error) });
      } catch (createError) {
        toast.error("Не получилось создать ключ");
        logEvent("shortcut-copy-key", {
          ok: false,
          error: String(createError),
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        Команда для iPhone: одно нажатие — и текст с экрана (например, карточки
        Duolingo) попадает во «Входящие» на странице «Слова».
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">1. Скопируй ключ</h2>
        <p className="text-muted-foreground">
          По ключу Word Drill узнаёт, что текст прислала твоя команда.
        </p>
        <Button
          variant={copied ? "outline" : "default"}
          className="self-start"
          disabled={create.isPending}
          onClick={copyKey}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Ключ скопирован" : "Скопировать ключ"}
        </Button>
        {shown && (
          <div className="flex flex-col gap-1 rounded-lg bg-secondary p-3">
            <p>Скопируй ключ вручную (показывается один раз):</p>
            <code className="select-all break-all text-xs">{shown}</code>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">2. Установи команду</h2>
        <p className="text-muted-foreground">
          Откроется экран с файлом: нажми «Open in “Shortcuts”» («Открыть в
          „Командах“»), вставь ключ и нажми «Add Shortcut» («Добавить»).
        </p>
        <Button
          asChild
          variant={copied || shown ? "default" : "outline"}
          className="self-start"
        >
          <a
            href={`${SHORTCUT_URL}?via=same`}
            onClick={() => openShortcut("same")}
          >
            <Download />
            Установить команду
          </a>
        </Button>
        <p className="text-muted-foreground">
          Вернуться в Word Drill с экрана файла нельзя (у него нет «Назад»):
          проведи вверх от нижнего края экрана и задержи палец, смахни Word
          Drill вверх и открой его снова.{" "}
          <a
            href={`${SHORTCUT_URL}?via=window`}
            target="_blank"
            rel="noreferrer"
            className="underline"
            onClick={() => openShortcut("window")}
          >
            Открыть в отдельном окне
          </a>{" "}
          — запасной вариант, если экран с файлом не появился.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">3. Запускай</h2>
        <p className="text-muted-foreground">
          Команда «Word Drill» — в приложении «Команды». Удобнее всего повесить
          её на кнопку действия или двойное касание задней панели (Настройки →
          Универсальный доступ → Касание). Не запускай её на экране с ключом —
          он попадёт в текст.
        </p>
      </section>

      {key && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">
            Ключ создан {new Date(key.createdAt).toLocaleDateString("ru")}
            {key.lastUsedAt
              ? ` · команда присылала текст ${new Date(key.lastUsedAt).toLocaleDateString("ru")}`
              : " · команда ещё не присылала текст"}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate(key.id);
              setCopied(false);
            }}
          >
            Отключить команду
          </Button>
          <p className="text-muted-foreground text-xs">
            После отключения команда перестанет работать, пока не скопируешь
            новый ключ и не установишь её заново.
          </p>
        </div>
      )}
    </div>
  );
}
