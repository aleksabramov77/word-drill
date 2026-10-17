import { z } from "zod";
import type { NewWord } from "@/entities/word";

export function splitAnswers(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((answer) => answer.trim())
    .filter(Boolean);
}

export const manualWordSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, "Напиши слово по-русски")
    .max(100, "Слишком длинно"),
  answers: z
    .string()
    .refine(
      (raw) => splitAnswers(raw).length > 0,
      "Напиши перевод по-английски",
    )
    .refine(
      (raw) => splitAnswers(raw).every((a) => a.length <= 100),
      "Слишком длинно",
    ),
});
export type ManualWord = z.infer<typeof manualWordSchema>;

export function toNewWord(values: ManualWord): NewWord {
  return {
    prompt: values.prompt.trim(),
    answers: splitAnswers(values.answers),
    source: "manual",
  };
}
