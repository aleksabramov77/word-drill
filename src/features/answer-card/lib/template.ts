import { plural } from "@/shared/lib/format";

// Шаблон слова, в который ответ вводится прямо по клеткам.
// mask — заготовка с сервера: null — пустая клетка, буква — открыта подсказкой, пробел и знаки — как есть.
// values — что введено в клетки (той же длины, "" — пусто).

export type Mask = readonly (string | null)[];

const LETTER = /[\p{L}\p{N}]/u;

/** Клетка для ввода (буква ещё не открыта). */
export function isSlot(mask: Mask, i: number): boolean {
  return mask[i] === null;
}

/** Открытая подсказкой буква (не пробел и не знак). */
export function isRevealed(mask: Mask, i: number): boolean {
  const ch = mask[i];
  return typeof ch === "string" && LETTER.test(ch);
}

/** Слова шаблона: индексы клеток каждого слова (пробелы — границы). */
export function templateWords(mask: Mask): number[][] {
  const words: number[][] = [[]];
  mask.forEach((ch, i) => {
    if (ch === " ") words.push([]);
    else words[words.length - 1]?.push(i);
  });
  return words.filter((word) => word.length > 0);
}

/** Первая клетка для ввода начиная с from (включительно) или -1. */
export function nextSlot(mask: Mask, from: number): number {
  for (let i = Math.max(0, from); i < mask.length; i++) {
    if (isSlot(mask, i)) return i;
  }
  return -1;
}

/** Ближайшая клетка для ввода левее before или -1. */
export function prevSlot(mask: Mask, before: number): number {
  for (let i = before - 1; i >= 0; i--) {
    if (isSlot(mask, i)) return i;
  }
  return -1;
}

/** Первая пустая клетка, иначе первая клетка для ввода. */
export function firstEmptySlot(mask: Mask, values: readonly string[]): number {
  const empty = mask.findIndex((ch, i) => ch === null && !values[i]);
  return empty >= 0 ? empty : nextSlot(mask, 0);
}

/**
 * Ввод текста с клетки at: буквы ложатся в клетки по порядку, открытые буквы пропускаются,
 * пробел переносит в начало следующего слова. Возвращает новые значения и клетку, куда встать курсору.
 */
export function typeInto(
  mask: Mask,
  values: readonly string[],
  at: number,
  text: string,
): { values: string[]; cursor: number } {
  const next = [...values];
  let cursor = at;
  let last = at;
  for (const ch of text) {
    if (ch === " ") {
      const space = mask.indexOf(" ", cursor);
      if (space < 0) continue;
      const start = nextSlot(mask, space + 1);
      if (start >= 0) cursor = start;
      continue;
    }
    if (!LETTER.test(ch)) continue;
    const slot = nextSlot(mask, cursor);
    if (slot < 0) break;
    next[slot] = ch;
    last = slot;
    cursor = slot + 1;
  }
  const after = nextSlot(mask, cursor);
  return { values: next, cursor: after >= 0 ? after : last };
}

/** Ответ из шаблона: открытые буквы и знаки — как есть, клетки — что введено (пустые пропускаются). */
export function templateAnswer(mask: Mask, values: readonly string[]): string {
  return mask.map((ch, i) => (ch === null ? (values[i] ?? "") : ch)).join("");
}

/** Подсказка длины: «5 букв» или для фразы «2 слова: 2 + 5 букв». */
export function lengthHint(mask: Mask): string {
  const counts = templateWords(mask).map(
    (word) => word.filter((i) => isSlot(mask, i) || isRevealed(mask, i)).length,
  );
  const lastCount = counts[counts.length - 1] ?? 0;
  const letters = plural(lastCount, "буква", "буквы", "букв");
  if (counts.length <= 1) return `${lastCount} ${letters}`;
  return `${counts.length} ${plural(counts.length, "слово", "слова", "слов")}: ${counts.join(" + ")} ${letters}`;
}
