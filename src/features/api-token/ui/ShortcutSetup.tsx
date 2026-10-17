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
 * Личный ключ (API-токен) для команды iOS «Команды»: скриншот → текст → «Входящие». Инструкция — в справке.
 */
export function ShortcutSetup() {
  const { data: tokens } = useTokens();
  const create = useCreateToken();
  const remove = useDeleteToken();
  const [fresh, setFresh] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        Ключ нужен команде iPhone «скриншот → Word Drill»: с ним она отправляет
        текст с экрана во «Входящие». Как собрать команду — «Ещё» → «Слова со
        скриншота».
      </p>

      {fresh ? (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
          <p className="font-medium">
            Ключ (показывается один раз — сохрани в команде):
          </p>
          <code className="break-all text-xs">{fresh}</code>
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => copy(fresh)}
          >
            <Copy />
            Скопировать ключ
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
          Создать ключ
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
                aria-label={`Удалить ключ ${t.prefix}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(t.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
