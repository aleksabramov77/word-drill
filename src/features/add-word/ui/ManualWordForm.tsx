import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { type NewWord, useAddWord, useWords } from "@/entities/word";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { type Existing, findExisting } from "../model/existing.ts";
import {
  type ManualWord,
  manualWordSchema,
  toNewWord,
} from "../model/manualWord.ts";
import { ExistingWordNotice } from "./ExistingWordNotice.tsx";

export function ManualWordForm() {
  const { data: words } = useWords();
  const addWord = useAddWord();
  const [existing, setExisting] = useState<Existing | null>(null);
  const form = useForm<ManualWord>({
    resolver: zodResolver(manualWordSchema),
    defaultValues: { prompt: "", answers: "" },
  });
  const { errors } = form.formState;

  const save = (word: NewWord) =>
    addWord.mutate(word, {
      onSuccess: (added) => {
        toast.success(
          `Добавлено: ${added.prompt} — ${added.answers.join(", ")}`,
        );
        setExisting(null);
        form.reset();
      },
      onError: () => toast.error("Не получилось добавить"),
    });

  // Уже есть в списке — показываем ту карточку вместо ошибки: её можно убрать (или добавить всё равно).
  const submit = form.handleSubmit((values) => {
    const word = toNewWord(values);
    const found = findExisting(words ?? [], word.prompt, word.answers);
    setExisting(found);
    if (!found) save(word);
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor="manual-prompt">По-русски (что будешь видеть)</label>
        <Input
          id="manual-prompt"
          {...form.register("prompt")}
          placeholder="кровь"
          autoComplete="off"
        />
        {errors.prompt && (
          <span className="text-destructive">{errors.prompt.message}</span>
        )}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor="manual-answers">
          По-английски (что надо ввести; несколько вариантов — через запятую)
        </label>
        <Input
          id="manual-answers"
          {...form.register("answers")}
          placeholder="blood"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          lang="en"
        />
        {errors.answers && (
          <span className="text-destructive">{errors.answers.message}</span>
        )}
      </div>
      <Button type="submit" disabled={addWord.isPending}>
        Добавить
      </Button>
      {existing && (
        <ExistingWordNotice
          word={existing.word}
          title={
            existing.kind === "same-prompt"
              ? "Уже в списке:"
              : "Этот перевод уже есть у другого слова:"
          }
          onRemoved={() => setExisting(null)}
        >
          {existing.kind === "same-answer" && (
            <Button
              size="sm"
              type="button"
              disabled={addWord.isPending}
              onClick={() => save(toNewWord(form.getValues()))}
            >
              Всё равно добавить
            </Button>
          )}
        </ExistingWordNotice>
      )}
    </form>
  );
}
