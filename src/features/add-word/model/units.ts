import type { DictionaryUnit } from "@/entities/dictionary";

const fold = (text: string) => text.toLowerCase().replaceAll("ё", "е").trim();

/**
 * Темы курса по запросу: часть русской цели («брак»), английского названия («marriage») или номер.
 * Пустой запрос — все темы по порядку.
 */
export function filterUnits(
  units: readonly DictionaryUnit[],
  query: string,
): DictionaryUnit[] {
  const q = fold(query);
  if (q === "") return [...units];
  if (/^\d+$/.test(q)) return units.filter((u) => String(u.n) === q);
  return units.filter((u) => fold(`${u.goal} ${u.title}`).includes(q));
}
