import { normalize } from "../../src/shared/lib/answer-check/index.ts";
import type { Dictionary, DictionaryWord } from "../dictionary/index.ts";

// Слова из текста скриншота (OCR) или «Поделиться»: какие слова словаря курса в нём есть.
// Пара — английское слово и одна из его русских форм в одном тексте (как на карточке Duolingo «кровь → blood»).
// Только сравнение строк, без нейросетей.

export interface Suggestion {
  word: DictionaryWord;
  /** Русская форма, найденная в том же тексте; null — нашлось только английское слово. */
  matchedRu: string | null;
}

const MAX_SUGGESTIONS = 15;
/** Одиночные короткие английские слова без пары — шум (a, to, is…). */
const MIN_LONE_LETTERS = 4;

function key(text: string): string {
  return text.toLowerCase().replaceAll("ё", "е").replace(/[’‘`]/g, "'");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Целое слово или фраза в тексте, не часть другого слова. */
export function containsWord(text: string, phrase: string): boolean {
  if (phrase === "") return false;
  return new RegExp(
    `(?<![\\p{L}'])${escapeRegExp(phrase)}(?![\\p{L}'])`,
    "u",
  ).test(text);
}

export function suggestWords(
  dictionary: Dictionary,
  rawText: string,
  /** Уже добавленные ответы (normalize) — их не предлагаем. */
  known: ReadonlySet<string>,
): Suggestion[] {
  const text = key(rawText);
  const result: Suggestion[] = [];
  for (const word of dictionary.words) {
    const en = key(word.en);
    if (known.has(normalize(word.en)) || !containsWord(text, en)) continue;
    const matchedRu =
      word.ru
        .filter((form) => containsWord(text, key(form)))
        .sort((a, b) => b.length - a.length)[0] ?? null;
    if (!matchedRu && en.replaceAll(" ", "").length < MIN_LONE_LETTERS)
      continue;
    result.push({ word, matchedRu });
  }
  // Пары выше одиночных, длинные фразы выше коротких (в «blood pressure» слово «blood» тоже найдётся).
  return result
    .sort(
      (a, b) =>
        Number(b.matchedRu !== null) - Number(a.matchedRu !== null) ||
        b.word.en.length - a.word.en.length,
    )
    .slice(0, MAX_SUGGESTIONS);
}
