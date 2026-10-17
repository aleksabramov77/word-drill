import { z } from "zod";

// Словарь курса Duolingo «английский для русскоязычных» (scripts/dict-import.ts → data/dictionary.json).

export const dictionaryUnitSchema = z.object({
  /** Номер юнита в пути курса. */
  n: z.number().int().positive(),
  title: z.string(),
  /** Цель юнита по-русски: «Предложи или прими напиток». */
  goal: z.string(),
});

export const dictionaryWordSchema = z.object({
  en: z.string().min(1),
  /** Русские формы, в которых слово встречается в курсе (падежи, спряжения). */
  ru: z.array(z.string()),
  /** Юниты, где слово встречается, по порядку. */
  units: z.array(z.number().int().positive()),
  /** Слова нет в текущей версии курса. */
  missing: z.boolean(),
});

export const dictionarySchema = z.object({
  source: z.string(),
  importedAt: z.string(),
  units: z.array(dictionaryUnitSchema),
  words: z.array(dictionaryWordSchema),
});

export type DictionaryUnit = z.infer<typeof dictionaryUnitSchema>;
export type DictionaryWord = z.infer<typeof dictionaryWordSchema>;
export type Dictionary = z.infer<typeof dictionarySchema>;
