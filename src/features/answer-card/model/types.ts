import { z } from "zod";

export const stageSchema = z.enum(["type", "hint", "choice", "show"]);
export type Stage = z.infer<typeof stageSchema>;

export const verdictSchema = z.enum([
  "correct",
  "typo",
  "partial",
  "synonym",
  "other-word",
  "wrong",
]);
export type Verdict = z.infer<typeof verdictSchema>;

export const drillCardSchema = z.object({
  wordId: z.number(),
  prompt: z.string(),
  /** Другие русские формы того же слова (по словарю) — мелко под главной, в случайном порядке. */
  alsoPrompts: z.array(z.string()).default([]),
  letters: z.number(),
  isNew: z.boolean(),
  hot: z.boolean(),
});
export type DrillCard = z.infer<typeof drillCardSchema>;

export const drillQueueSchema = z.object({
  card: drillCardSchema.nullable(),
  dueCount: z.number(),
  newCount: z.number(),
  nextDue: z.string().nullable(),
});
export type DrillQueue = z.infer<typeof drillQueueSchema>;

export const stepResultSchema = z.object({
  verdict: verdictSchema.optional(),
  correct: z.boolean(),
  expected: z.string(),
  next: z.union([stageSchema, z.literal("done")]),
  /** Заготовка: null — скрытая буква. */
  mask: z.array(z.string().nullable()).optional(),
  revealed: z.number().optional(),
  /** Уровень подсказки: 1 — число букв, 2 — шаблон (дальше открываются буквы). */
  hintLevel: z.union([z.literal(1), z.literal(2)]).optional(),
  options: z.array(z.string()).optional(),
  outcome: z
    .object({
      grade: z.number(),
      status: z.enum(["new", "learning", "errors", "learned"]),
      hot: z.boolean(),
      due: z.string(),
      knowledge: z.number(),
    })
    .optional(),
});
export type StepResult = z.infer<typeof stepResultSchema>;

export type HintAction = "reveal" | "choices";
