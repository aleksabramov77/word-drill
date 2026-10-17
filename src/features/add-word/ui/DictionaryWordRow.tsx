import { Check, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { DictionaryWord } from "@/entities/dictionary";
import { useAddWord, useDeleteWord, type Word } from "@/entities/word";
import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";

const VISIBLE_FORMS = 8;

/**
 * Слово из словаря: русских форм много (падежи, спряжения) — выбираешь ту, которую будешь видеть в вопросе.
 * По умолчанию — совпавшая при поиске или первая.
 */
export function DictionaryWordRow({
  word,
  matched,
  added,
}: {
  word: DictionaryWord;
  matched?: string;
  /** Это слово уже в списке — показываем «Добавлено» и «Убрать». */
  added?: Word;
}) {
  const [prompt, setPrompt] = useState(matched ?? word.ru[0] ?? "");
  const [expanded, setExpanded] = useState(false);
  const addWord = useAddWord();
  const removeWord = useDeleteWord();
  const forms = expanded ? word.ru : word.ru.slice(0, VISIBLE_FORMS);

  const add = () =>
    addWord.mutate(
      { prompt, answers: [word.en], source: "dictionary" },
      {
        onSuccess: () => toast.success(`Добавлено: ${prompt} — ${word.en}`),
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? `«${prompt}» уже есть в списке`
              : "Не получилось добавить",
          ),
      },
    );

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{word.en}</span>
          {word.units[0] !== undefined && (
            <span className="ml-2 text-muted-foreground text-xs">
              юнит {word.units[0]}
            </span>
          )}
          {word.missing && (
            <span className="ml-2 text-muted-foreground text-xs">
              нет в курсе
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
              aria-label={`Убрать ${word.en}`}
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
            disabled={addWord.isPending || prompt === ""}
            onClick={add}
            aria-label={`Добавить ${word.en}`}
          >
            <Plus />
            Добавить
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {forms.map((form) => (
          <button
            key={form}
            type="button"
            onClick={() => setPrompt(form)}
            className={
              form === prompt
                ? "rounded-full bg-primary px-2.5 py-0.5 text-primary-foreground text-sm"
                : "rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground text-sm"
            }
          >
            {form}
          </button>
        ))}
        {word.ru.length > VISIBLE_FORMS && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-1 text-muted-foreground text-sm underline"
          >
            ещё {word.ru.length - VISIBLE_FORMS}
          </button>
        )}
      </div>
    </li>
  );
}
