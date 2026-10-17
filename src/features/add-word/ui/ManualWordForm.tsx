import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAddWord } from "@/entities/word";
import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  type ManualWord,
  manualWordSchema,
  toNewWord,
} from "../model/manualWord.ts";

export function ManualWordForm() {
  const addWord = useAddWord();
  const form = useForm<ManualWord>({
    resolver: zodResolver(manualWordSchema),
    defaultValues: { prompt: "", answers: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    addWord.mutate(toNewWord(values), {
      onSuccess: (word) => {
        toast.success(`Добавлено: ${word.prompt} — ${word.answers.join(", ")}`);
        form.reset();
      },
      onError: (error) =>
        error instanceof ApiError && error.status === 409
          ? form.setError("prompt", { message: "Это слово уже есть в списке" })
          : toast.error("Не получилось добавить"),
    }),
  );

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
    </form>
  );
}
