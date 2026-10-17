import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { useCreateToken, useDeleteToken, useTokens } from "../api/tokenApi.ts";

/** Готовая команда (scripts/build-shortcut.ts); при установке iPhone спрашивает ключ. */
const SHORTCUT_URL = "/word-drill.shortcut";

/**
 * Команда iPhone «скриншот → Word Drill» в два шага: скопировать ключ, открыть файл команды.
 * - Ключ один: новый заменяет прежний (server/auth/tokens.ts).
 * - Ключ кладётся в буфер через ClipboardItem с обещанием: Safari разрешает запись в буфер только
 *   прямо по нажатию, а ключ приходит с сервера чуть позже.
 * - Файл открывается в отдельном окне (target=_blank): внутри приложения с экрана «Домой»
 *   у экрана файла нет кнопок «Назад» и «Готово» — из него не выйти.
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
    } catch {
      // Буфер недоступен — покажем ключ, его можно выделить и скопировать.
      try {
        setShown(await token);
      } catch {
        toast.error("Не получилось создать ключ");
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
          Откроется окно с файлом: нажми «Open in “Shortcuts”» («Открыть в
          „Командах“»), вставь ключ и нажми «Add Shortcut» («Добавить»).
          Вернуться — кнопкой «Готово» вверху окна.
        </p>
        <Button
          asChild
          variant={copied || shown ? "default" : "outline"}
          className="self-start"
        >
          <a href={SHORTCUT_URL} target="_blank" rel="noreferrer">
            <Download />
            Установить команду
          </a>
        </Button>
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
