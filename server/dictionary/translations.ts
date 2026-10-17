import { normalize } from "../../src/shared/lib/answer-check/index.ts";
import type { Dictionary } from "./schema.ts";

// Переводы в обе стороны по словарю курса: другие русские формы того же английского слова
// (показываются на карточке мелко под главной) и другие английские переводы этих форм
// (синонимы: «тоже верно, но загадано другое слово»). Только сравнение строк.

interface Index {
  /** Английское слово (normalize) → его русские формы. */
  ruByEn: Map<string, string[]>;
  /** Русская форма (нижний регистр, ё → е) → английские слова. */
  enByRu: Map<string, string[]>;
}

const indexes = new WeakMap<Dictionary, Index>();

const ruKey = (text: string) => text.trim().toLowerCase().replaceAll("ё", "е");

function index(dictionary: Dictionary): Index {
  const cached = indexes.get(dictionary);
  if (cached) return cached;
  const ruByEn = new Map<string, string[]>();
  const enByRu = new Map<string, string[]>();
  for (const word of dictionary.words) {
    ruByEn.set(normalize(word.en), word.ru);
    for (const ru of word.ru) {
      const list = enByRu.get(ruKey(ru)) ?? [];
      list.push(word.en);
      enByRu.set(ruKey(ru), list);
    }
  }
  const built = { ruByEn, enByRu };
  indexes.set(dictionary, built);
  return built;
}

/** Другие русские формы основного ответа по словарю — кроме той, что выбрана главной. */
export function otherForms(
  dictionary: Dictionary,
  answer: string,
  prompt: string,
): string[] {
  const forms = index(dictionary).ruByEn.get(normalize(answer)) ?? [];
  return forms.filter((form) => ruKey(form) !== ruKey(prompt));
}

/** Другие английские переводы этих русских форм — кроме ответов самой карточки. */
export function synonymsOf(
  dictionary: Dictionary,
  forms: readonly string[],
  answers: readonly string[],
): string[] {
  const { enByRu } = index(dictionary);
  const own = new Set(answers.map(normalize));
  const result = new Set<string>();
  for (const form of forms) {
    for (const en of enByRu.get(ruKey(form)) ?? []) {
      if (!own.has(normalize(en))) result.add(en);
    }
  }
  return [...result];
}
