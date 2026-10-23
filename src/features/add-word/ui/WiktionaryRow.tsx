import { Check, ExternalLink, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { WiktHit } from "@/entities/dictionary";
import { useAddWord, useDeleteWord, type Word } from "@/entities/word";
import { ApiError } from "@/shared/api";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

/**
 * Слово из Викисловаря: переводов несколько — касанием выбираешь, какие засчитывать.
 * Первый выбранный — тот, что показывается в шаблоне и подсказках.
 */
export function WiktionaryRow({
  hit,
  added,
}: {
  hit: WiktHit;
  /** Это слово уже в списке — показываем «Добавлено» и «Убрать». */
  added?: Word;
}) {
  const [picked, setPicked] = useState<string[]>(hit.en.slice(0, 1));
  const addWord = useAddWord();
  const removeWord = useDeleteWord();
  const toggle = (en: string) =>
    setPicked((current) =>
      current.includes(en) ? current.filter((x) => x !== en) : [...current, en],
    );

  const add = () =>
    addWord.mutate(
      { prompt: hit.ru, answers: picked, source: "manual" },
      {
        onSuccess: () =>
          toast.success(`Добавлено: ${hit.ru} — ${picked.join(", ")}`),
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? `«${hit.ru}» уже есть в списке`
              : "Не получилось добавить",
          ),
      },
    );

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-lg">{hit.ru}</span>
          {hit.matched && (
            <span className="text-muted-foreground text-sm">
              нашлось по «{hit.matched}»
            </span>
          )}
        </div>
        {added ? (
          <div className="flex shrink-0 items-center gap-1">
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="size-4" />
              Добавлено
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={removeWord.isPending}
              aria-label={`Убрать ${hit.ru}`}
              onClick={() =>
                removeWord.mutate(added.id, {
                  onSuccess: () => toast.success(`Убрано: ${added.prompt}`),
                })
              }
            >
              <Undo2 />
              Убрать
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="shrink-0"
            disabled={addWord.isPending || picked.length === 0}
            onClick={add}
            aria-label={`Добавить ${hit.ru}`}
          >
            <Plus />
            Добавить
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hit.en.map((en) => (
          <button
            key={en}
            type="button"
            aria-pressed={picked.includes(en)}
            onClick={() => toggle(en)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-sm",
              picked.includes(en)
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {en}
          </button>
        ))}
        <a
          href={`https://en.wiktionary.org/wiki/${encodeURIComponent(hit.ru)}#Russian`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 px-1 text-muted-foreground text-sm underline"
        >
          Викисловарь
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </li>
  );
}
