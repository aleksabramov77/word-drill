import type {
  Dictionary,
  DictionaryUnit,
  DictionaryWord,
} from "../../server/dictionary/index.ts";

// Разбор страниц словаря duome.eu: /vocabulary/ru/en (по алфавиту) и /vocabulary/ru/en/skills (по юнитам курса).
// Слово: <li class=" [missing]">…<span class="_blue  wA">blood</span><span class="cCCC wT"> - кровь, крови</span></li>
// Юнит:  <div class="path-section-delimiter"><hr><span title="…">1 <span class="small-label">Home Visit</span> Цель</span>

interface ParsedWord {
  en: string;
  ru: string[];
  missing: boolean;
}

const ITEM = /<li class="([^"]*)">([\s\S]*?)<\/li>/g;
const WORD =
  /<span class="_blue\s+wA">([\s\S]*?)<\/span><span class="cCCC wT">([\s\S]*?)<\/span>/;
const UNIT =
  /<div class="path-section-delimiter"><hr><span title="[^"]*">\s*(\d+)\s*<span class="small-label">([\s\S]*?)<\/span>([\s\S]*?)<\/span><hr><\/div>/;
const CYRILLIC = /\p{Script=Cyrillic}/u;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&#039;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&[#a-z0-9]+;/gi, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

/** Русские переводы: только кириллица, без одиночных букв и повторов. */
export function parseTranslations(raw: string): string[] {
  const list = text(raw).replace(/^-\s*/, "");
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list.split(",")) {
    const form = item.trim();
    if (form.length < 2 || !CYRILLIC.test(form) || seen.has(form)) continue;
    seen.add(form);
    result.push(form);
  }
  return result;
}

function parseWord(classes: string, body: string): ParsedWord | null {
  const match = WORD.exec(body);
  if (!match) return null;
  const en = text(match[1] ?? "");
  if (en === "") return null;
  return {
    en,
    ru: parseTranslations(match[2] ?? ""),
    missing: classes.split(/\s+/).includes("missing"),
  };
}

export function parseAlphabetical(html: string): ParsedWord[] {
  const words: ParsedWord[] = [];
  for (const [, classes = "", body = ""] of html.matchAll(ITEM)) {
    const word = parseWord(classes, body);
    if (word) words.push(word);
  }
  return words;
}

export interface ParsedSkills {
  units: DictionaryUnit[];
  /** Слово → юниты, где оно встречается, по порядку. */
  wordUnits: Map<string, number[]>;
  /** Переводы из вида по юнитам: дополняют алфавитный список. */
  translations: Map<string, string[]>;
}

export function parseSkills(html: string): ParsedSkills {
  const units: DictionaryUnit[] = [];
  const wordUnits = new Map<string, number[]>();
  const translations = new Map<string, string[]>();
  let current: number | null = null;

  for (const [, classes = "", body = ""] of html.matchAll(ITEM)) {
    const unit = UNIT.exec(body);
    if (unit) {
      current = Number(unit[1]);
      units.push({
        n: current,
        title: text(unit[2] ?? ""),
        goal: text(unit[3] ?? ""),
      });
      continue;
    }
    const word = parseWord(classes, body);
    if (!word || current === null) continue;
    const list = wordUnits.get(word.en) ?? [];
    if (!list.includes(current)) list.push(current);
    wordUnits.set(word.en, list);
    translations.set(word.en, word.ru);
  }
  return { units, wordUnits, translations };
}

export function buildDictionary(
  alphabetical: readonly ParsedWord[],
  skills: ParsedSkills,
  source: string,
  importedAt: Date,
): Dictionary {
  const words = new Map<string, DictionaryWord>();
  for (const word of alphabetical) {
    words.set(word.en, {
      en: word.en,
      ru: word.ru,
      units: skills.wordUnits.get(word.en) ?? [],
      missing: word.missing,
    });
  }
  // Слова, которые есть только в виде по юнитам.
  for (const [en, units] of skills.wordUnits) {
    if (words.has(en)) continue;
    words.set(en, {
      en,
      ru: skills.translations.get(en) ?? [],
      units,
      missing: false,
    });
  }
  return {
    source,
    importedAt: importedAt.toISOString(),
    units: [...skills.units].sort((a, b) => a.n - b.n),
    words: [...words.values()]
      .filter((word) => word.ru.length > 0)
      .sort((a, b) => a.en.localeCompare(b.en)),
  };
}
