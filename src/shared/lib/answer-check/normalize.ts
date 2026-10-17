// Приведение ответа к виду, в котором сравниваются строки: регистр, ё, апострофы, дефисы, пунктуация, пробелы.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[’‘`´]/g, "'")
    .replace(/[-‐–—_/]/g, " ")
    .replace(/[^\p{L}\p{N}' ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Артикль у существительного и `to` у глагола необязательны: «the boy» = «boy», «to run» = «run».
export function stripOptional(normalized: string): string {
  return normalized.replace(/^(a|an|the) /, "").replace(/^to /, "");
}

// Британское и американское написание сводятся к одному виду: colour = color, centre = center, realise = realize.
// Минимальная длина основы отсекает короткие слова (hour, four, tour), где правило дало бы чужое слово.
const SPELLING_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/(\p{L}{3,})our\b/gu, "$1or"],
  [/(\p{L}{2,})tre\b/gu, "$1ter"],
  [/(\p{L}{3,})yse\b/gu, "$1yze"],
  [/(\p{L}{3,})is(e|ed|es|ing|ation)\b/gu, "$1iz$2"],
  [/(\p{L}{3,})ogue\b/gu, "$1og"],
];

export function canonicalSpelling(normalized: string): string {
  return SPELLING_RULES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    normalized,
  );
}
