import type { Dictionary, DictionaryWord } from "./schema.ts";

export interface SearchHit {
  word: DictionaryWord;
  /** Что совпало: английское слово или русская форма. */
  matched: string;
}

const CYRILLIC = /\p{Script=Cyrillic}/u;

function key(text: string): string {
  return text.toLowerCase().replaceAll("ё", "е").trim();
}

function score(form: string, query: string, exact: number): number {
  if (form === query) return exact;
  if (form.startsWith(query)) return exact - 20 - (form.length - query.length);
  if (form.includes(query)) return exact - 60 - (form.length - query.length);
  return 0;
}

/**
 * Поиск по словарю: кириллица ищется в русских формах, латиница — в английских словах.
 * Порядок: точное совпадение, начало слова, вхождение; короче — выше; слова текущего курса — выше удалённых.
 */
export function searchDictionary(
  dictionary: Dictionary,
  rawQuery: string,
  limit = 20,
): SearchHit[] {
  const query = key(rawQuery);
  if (query === "") return [];
  const russian = CYRILLIC.test(query);

  const hits: (SearchHit & { score: number })[] = [];
  for (const word of dictionary.words) {
    const forms = russian ? word.ru : [word.en];
    let best = 0;
    let matched = "";
    for (const form of forms) {
      const s = score(key(form), query, 100);
      if (s > best) {
        best = s;
        matched = form;
      }
    }
    if (best > 0) {
      hits.push({ word, matched, score: best - (word.missing ? 50 : 0) });
    }
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.word.en.length - b.word.en.length ||
      a.word.en.localeCompare(b.word.en),
  );
  return hits.slice(0, limit).map(({ word, matched }) => ({ word, matched }));
}

export function unitWords(
  dictionary: Dictionary,
  unit: number,
): DictionaryWord[] {
  return dictionary.words.filter((word) => word.units.includes(unit));
}
