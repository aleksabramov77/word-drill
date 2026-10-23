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

/** Слово из Викисловаря: русское слово и короткие английские переводы. */
export const wiktHitSchema = z.object({
  ru: z.string(),
  en: z.array(z.string()),
  /** Что совпало, если не само слово: форма («крови») или английский перевод. */
  matched: z.string().optional(),
});
export type WiktHit = z.infer<typeof wiktHitSchema>;
