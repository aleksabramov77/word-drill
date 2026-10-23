// Разбор выгрузки Викисловаря с kaikki.org (английский Викисловарь, русские слова) в строки data/wiktionary.tsv.gz.
import type { WiktEntry } from "../../server/wiktionary/index.ts";

/** Не слова для заучивания: имена, буквы, приставки, пословицы. */
const SKIP_POS = new Set([
  "name",
  "character",
  "symbol",
  "suffix",
  "prefix",
  "infix",
  "interfix",
  "affix",
  "romanization",
  "proverb",
  "letter",
  "punct",
  "combining_form",
]);
/** Значения, которые не нужны: формы другого слова, устаревшее, сокращения. */
const SKIP_TAGS = new Set([
  "form-of",
  "alt-of",
  "misspelling",
  "obsolete",
  "archaic",
  "dated",
  "abbreviation",
  "initialism",
]);
/** Короткие пояснения в скобках, которые часть перевода: «to take care (of)» → «to take care of». */
const KEEP_IN_PARENS = new Set([
  "of",
  "for",
  "with",
  "to",
  "about",
  "on",
  "at",
  "in",
  "from",
  "oneself",
  "up",
  "out",
  "off",
]);
const MAX_EN = 6;
const MAX_GLOSS_LENGTH = 30;
const MAX_GLOSS_WORDS = 4;
const ENGLISH = /^[A-Za-z][A-Za-z '\-.]*$/;
const RUSSIAN = /^[Ѐ-ӿ][Ѐ-ӿ -]*$/;
/** Современная кириллица, без дореформенных ѣ, і, ѳ, ѵ и твёрдого знака на конце слова. */
const MODERN = /^[а-яё][а-яё-]*$/i;
const OLD_HARD_SIGN = /ъ$/;
/** Знаки ударения в формах: «кро́ви» → «крови». */
const STRESS = /[̀́]/g;

interface KaikkiSense {
  glosses?: string[];
  tags?: string[];
}
interface KaikkiForm {
  form?: string;
  tags?: string[];
}
export interface KaikkiEntry {
  word?: string;
  pos?: string;
  senses?: KaikkiSense[];
  forms?: KaikkiForm[];
}

/** Формы — только словоизменение самого слова: без родственных слов («домик», «домашний»), старых написаний и служебных строк. */
const FORM_SKIP_TAGS = new Set([
  "romanization",
  "table-tags",
  "inflection-template",
  "class",
  "adjective",
  "relational",
  "diminutive",
  "augmentative",
  "pejorative",
  "endearing",
  "alternative",
  "archaic",
  "dated",
  "obsolete",
  "nonstandard",
  "pre-reform",
]);

/** Короткие английские переводы из определения: «(of a person) beautiful, handsome; fine» → beautiful, handsome, fine. */
export function glossParts(gloss: string): string[] {
  const unwrapped = gloss.replace(/\(([^)]*)\)/g, (_, inner: string) =>
    KEEP_IN_PARENS.has(inner.trim()) ? ` ${inner.trim()}` : "",
  );
  return unwrapped
    .split(/[;,]/)
    .map((part) => part.trim().replace(/\s+/g, " ").replace(/\.$/, ""))
    .filter(
      (part) =>
        part !== "" &&
        part.length <= MAX_GLOSS_LENGTH &&
        part.split(" ").length <= MAX_GLOSS_WORDS &&
        ENGLISH.test(part),
    );
}

/** Одна статья kaikki → слово словаря (null — не нужна). */
export function extractEntry(raw: KaikkiEntry): WiktEntry | null {
  const ru = raw.word?.trim() ?? "";
  if (!RUSSIAN.test(ru) || ru.length > 30) return null;
  if (raw.pos && SKIP_POS.has(raw.pos)) return null;
  const en: string[] = [];
  for (const sense of raw.senses ?? []) {
    if (sense.tags?.some((tag) => SKIP_TAGS.has(tag))) continue;
    const gloss = sense.glosses?.at(-1);
    if (!gloss) continue;
    for (const part of glossParts(gloss)) if (!en.includes(part)) en.push(part);
  }
  if (en.length === 0) return null;
  const forms = new Set<string>();
  for (const f of raw.forms ?? []) {
    if (!f.form || f.tags?.some((tag) => FORM_SKIP_TAGS.has(tag))) continue;
    const form = f.form.replace(STRESS, "").trim();
    // Составное будущее («буду идти») не нужно: ищут одно слово.
    if (
      form !== ru &&
      !form.includes(" ") &&
      MODERN.test(form) &&
      !OLD_HARD_SIGN.test(form)
    )
      forms.add(form);
  }
  return { ru, en, forms: [...forms] };
}

/** Одно слово бывает в нескольких статьях (разные части речи) — склеиваем по русскому слову. */
export function mergeEntries(entries: Iterable<WiktEntry>): WiktEntry[] {
  const byRu = new Map<string, { en: string[]; forms: Set<string> }>();
  for (const entry of entries) {
    const merged = byRu.get(entry.ru) ?? { en: [], forms: new Set<string>() };
    for (const en of entry.en) if (!merged.en.includes(en)) merged.en.push(en);
    for (const form of entry.forms) merged.forms.add(form);
    byRu.set(entry.ru, merged);
  }
  return [...byRu].map(([ru, { en, forms }]) => ({
    ru,
    en: en.slice(0, MAX_EN),
    forms: [...forms].sort(),
  }));
}
