import { z } from "zod";

export const wordStatusSchema = z.enum([
  "new",
  "learning",
  "errors",
  "learned",
]);
export type WordStatus = z.infer<typeof wordStatusSchema>;

export const wordSchema = z.object({
  id: z.number(),
  prompt: z.string(),
  answers: z.array(z.string()),
  source: z.enum(["dictionary", "manual", "inbox"]),
  status: wordStatusSchema,
  hot: z.boolean(),
  recall: z.number(),
  due: z.string(),
  reps: z.number(),
  lapses: z.number(),
  createdAt: z.string(),
});
export type Word = z.infer<typeof wordSchema>;

export interface NewWord {
  prompt: string;
  answers: string[];
  source: Word["source"];
}
