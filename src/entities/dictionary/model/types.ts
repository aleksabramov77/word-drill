import { z } from "zod";

export const dictionaryWordSchema = z.object({
  en: z.string(),
  ru: z.array(z.string()),
  units: z.array(z.number()),
  missing: z.boolean(),
});
export type DictionaryWord = z.infer<typeof dictionaryWordSchema>;

export const dictionaryUnitSchema = z.object({
  n: z.number(),
  title: z.string(),
  goal: z.string(),
});
export type DictionaryUnit = z.infer<typeof dictionaryUnitSchema>;

export const searchHitSchema = z.object({
  word: dictionaryWordSchema,
  matched: z.string(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;
