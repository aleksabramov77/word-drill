import { Copy, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { useCreateToken, useDeleteToken, useTokens } from "../api/tokenApi.ts";

/** Готовая команда (scripts/build-shortcut.ts); при установке iPhone спрашивает ключ. */
const SHORTCUT_URL = "/word-drill.shortcut";

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Скопировано"),
    () => toast.error("Не получилось скопировать — выдели и скопируй вручную"),
  );
}

/**
 * Команда iPhone «скриншот → Word Drill» в одну кнопку: новый ключ → в буфер обмена → файл команды.
 * Ключ кладётся в буфер через ClipboardItem с обещанием: Safari разрешает запись в буфер только
 * прямо по нажатию, а ключ приходит с сервера чуть позже.
 */
export function ShortcutSetup() {
  const { data: tokens } = useTokens();
  const create = useCreateToken();
  const remove = useDeleteToken();
  const [pending, setPending] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  const install = async () => {
    setPending(true);
    const token = create.mutateAsync();
    let copied = false;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": token.then(
            (t) => new Blob([t], { type: "text/plain" }),
          ),
        }),
      ]);
      copied = true;
    } catch {
      // Буфер недоступен — ключ покажем на экране.
    }
    try {
      const value = await token;
      setFresh(value);
      if (copied) {
        toast.success("Ключ скопирован — вставь его при установке команды");
        window.location.href = SHORTCUT_URL;
      }
    } catch {
      toast.error("Не получилось создать ключ");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        Команда для iPhone: одно нажатие — и текст с экрана (например, карточки
        Duolingo) попадает во «Входящие» на странице «Слова».
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        <li>Нажми «Установить команду» — ключ скопируется сам.</li>
        <li>Откроются «Команды»: вставь ключ в поле и нажми «Добавить».</li>
        <li>
          Запускай команду «Word Drill» кнопкой действия или двойным касанием
          задней панели (Настройки → Универсальный доступ → Касание).
        </li>
      </ol>
      <Button className="self-start" disabled={pending} onClick={install}>
        <Download />
        Установить команду
      </Button>

      {fresh && (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
          <p className="font-medium">
            Ключ (показывается один раз — вставь его в команду):
          </p>
          <code className="break-all text-xs">{fresh}</code>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copyText(fresh)}>
              <Copy />
              Скопировать ключ
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={SHORTCUT_URL}>
                <Download />
                Открыть команду
              </a>
            </Button>
          </div>
        </div>
      )}

      {tokens && tokens.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-xs">
            Ключи (удали ненужные — команда с удалённым ключом перестанет
            работать):
          </p>
          <ul className="flex flex-col gap-1">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-muted-foreground text-xs">
                  {t.prefix}… · создан{" "}
                  {new Date(t.createdAt).toLocaleDateString("ru")}
                  {t.lastUsedAt &&
                    ` · использован ${new Date(t.lastUsedAt).toLocaleDateString("ru")}`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Удалить ключ ${t.prefix}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(t.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
