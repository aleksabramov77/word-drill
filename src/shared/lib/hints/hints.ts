// Подсказки по буквам (метод «исчезающих подсказок», Glisky, Schacter & Tulving, 1986):
// сначала число букв, потом шаблон (заготовка), потом по одной букве. Первыми открываются первые буквы слов —
// это самая сильная подсказка; дальше — случайные. Последнюю скрытую букву не открываем никогда: слово дописываешь сам.

const LETTER = /[\p{L}\p{N}]/u;

function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && LETTER.test(ch);
}

/** Ответ для шаблона: без артикля и «to» в начале — проверка ответа их и так не требует. */
export function templateBase(answer: string): string {
  return answer.replace(/^(a|an|the)\s+/i, "").replace(/^to\s+/i, "");
}

/** Сколько букв в ответе (пробелы, дефисы, апострофы не считаются). */
export function hintLetters(answer: string): number {
  return [...answer].filter(isLetter).length;
}

/** Заготовка: буквы — null (скрыта) или сама буква (открыта); пробелы и знаки — как есть. */
export function maskAnswer(
  answer: string,
  revealed: readonly number[],
): (string | null)[] {
  const open = new Set(revealed);
  return [...answer].map((ch, i) => (isLetter(ch) && !open.has(i) ? null : ch));
}

/** Индексы букв, которые уже верно вписаны в шаблон (их не открываем — открываем другие). */
export function knownLetters(
  answer: string,
  cells: readonly string[],
): number[] {
  const chars = [...answer];
  return chars
    .map((ch, i) =>
      isLetter(ch) && cells[i]?.toLowerCase() === ch.toLowerCase() ? i : -1,
    )
    .filter((i) => i >= 0);
}

/**
 * Индекс следующей буквы для подсказки или null, если неизвестной осталась одна (её не открываем).
 * known — буквы, уже верно вписанные в шаблон: они считаются известными и не открываются.
 */
export function nextHintIndex(
  answer: string,
  revealed: readonly number[],
  random = Math.random,
  known: readonly number[] = [],
): number | null {
  const chars = [...answer];
  const open = new Set([...revealed, ...known]);
  const hidden = chars
    .map((ch, i) => (isLetter(ch) && !open.has(i) ? i : -1))
    .filter((i) => i >= 0);
  if (hidden.length <= 1) return null;

  const wordStart = hidden.find((i) => !isLetter(chars[i - 1]));
  if (wordStart !== undefined) return wordStart;
  return hidden[Math.floor(random() * hidden.length)] ?? null;
}
