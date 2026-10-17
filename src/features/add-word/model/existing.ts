import type { Word } from "@/entities/word";
import { normalize } from "@/shared/lib/answer-check";

/** Слова списка по каждому английскому ответу — чтобы у слова словаря показать «Добавлено» и «Убрать». */
export function wordsByAnswer(words: readonly Word[]): Map<string, Word> {
  const map = new Map<string, Word>();
  for (const word of words) {
    for (const answer of word.answers) map.set(normalize(answer), word);
  }
  return map;
}

export type Existing =
  /** Та же карточка: такое русское слово уже есть — второй раз не добавить. */
  | { kind: "same-prompt"; word: Word }
  /** Тот же английский ответ под другим русским словом — можно добавить всё равно. */
  | { kind: "same-answer"; word: Word };

export function findExisting(
  words: readonly Word[],
  prompt: string,
  answers: readonly string[],
): Existing | null {
  const key = normalize(prompt);
  const samePrompt = words.find((w) => normalize(w.prompt) === key);
  if (samePrompt) return { kind: "same-prompt", word: samePrompt };
  const keys = new Set(answers.map(normalize));
  const sameAnswer = words.find((w) =>
    w.answers.some((a) => keys.has(normalize(a))),
  );
  return sameAnswer ? { kind: "same-answer", word: sameAnswer } : null;
}
