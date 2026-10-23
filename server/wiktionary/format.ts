// Словарь из Викисловаря (scripts/wikt-import.ts → data/wiktionary.tsv.gz).
// Строка: русское слово ⇥ английские переводы через «|» ⇥ формы слова (падежи, спряжения) через «|».
// Строки с «#» — служебные (источник, дата выгрузки).

export const DEFAULT_WIKTIONARY_PATH = "data/wiktionary.tsv.gz";

export interface WiktEntry {
  ru: string;
  en: string[];
  forms: string[];
}

export function formatLine(entry: WiktEntry): string {
  return [entry.ru, entry.en.join("|"), entry.forms.join("|")].join("\t");
}

export function parseLine(line: string): WiktEntry | null {
  if (line === "" || line.startsWith("#")) return null;
  const [ru = "", en = "", forms = ""] = line.split("\t");
  if (ru === "" || en === "") return null;
  return {
    ru,
    en: en.split("|"),
    forms: forms === "" ? [] : forms.split("|"),
  };
}

/** Ключ поиска: регистр и ё/е не различаются. */
export function searchKey(text: string): string {
  return text.toLowerCase().replaceAll("ё", "е").trim();
}
