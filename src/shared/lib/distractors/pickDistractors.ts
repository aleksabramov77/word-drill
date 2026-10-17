import { normalize } from "../answer-check/index.ts";

// Неправильные варианты для выбора: похожие на верный ответ по буквам и длине, чтобы угадать было нельзя.
// Берём самых похожих с запасом и выбираем из них случайно, чтобы набор не повторялся каждый раз.

const CANDIDATE_FACTOR = 3;
const MIN_CANDIDATES = 8;

function bigrams(text: string): string[] {
  const padded = ` ${text} `;
  return Array.from({ length: padded.length - 1 }, (_, i) =>
    padded.slice(i, i + 2),
  );
}

/** Коэффициент Дайса по парам букв: 1 — одинаковые слова, 0 — ничего общего. */
export function letterSimilarity(a: string, b: string): number {
  const left = bigrams(a);
  const right = bigrams(b);
  const pool = new Map<string, number>();
  for (const pair of right) pool.set(pair, (pool.get(pair) ?? 0) + 1);
  let common = 0;
  for (const pair of left) {
    const count = pool.get(pair) ?? 0;
    if (count > 0) {
      common++;
      pool.set(pair, count - 1);
    }
  }
  return (2 * common) / (left.length + right.length);
}

function lengthSimilarity(a: string, b: string): number {
  return 1 - Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1);
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function pickDistractors(
  answer: string,
  pool: readonly string[],
  count = 3,
  random = Math.random,
): string[] {
  const target = normalize(answer);
  const seen = new Set([target]);
  const candidates: { word: string; score: number }[] = [];
  for (const word of pool) {
    const key = normalize(word);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      word,
      score:
        letterSimilarity(target, key) + 0.5 * lengthSimilarity(target, key),
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(
    0,
    Math.max(count * CANDIDATE_FACTOR, MIN_CANDIDATES),
  );
  return shuffle(top, random)
    .slice(0, count)
    .map((c) => c.word);
}
