// Скорость ответа, независимая от длины слова: время сверх «реакции» (прочитать и вспомнить), делённое на число букв.
// Время реакции оценивается по истории ответов линейной регрессией: время = реакция + на_букву × буквы.

export interface SpeedSample {
  elapsedMs: number;
  letters: number;
}

export type Speed = "fast" | "normal" | "slow";

export const DEFAULT_REACTION_MS = 1500;
const MIN_REACTION_MS = 500;
const MAX_REACTION_MS = 4000;
/** Ответы дольше минуты — отвлёкся, а не печатал: в историю не идут и считаются медленными. */
export const MAX_ELAPSED_MS = 60_000;
export const SPEED_HISTORY_SIZE = 30;
const MIN_SAMPLES_FOR_REGRESSION = 10;
const MIN_SAMPLES_FOR_SPEED = 5;
const FAST_RATIO = 0.8;
const SLOW_RATIO = 1.6;

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function estimateReactionMs(history: readonly SpeedSample[]): number {
  if (history.length < MIN_SAMPLES_FOR_REGRESSION) return DEFAULT_REACTION_MS;
  const n = history.length;
  const meanX = history.reduce((sum, s) => sum + s.letters, 0) / n;
  const meanY = history.reduce((sum, s) => sum + s.elapsedMs, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const s of history) {
    covariance += (s.letters - meanX) * (s.elapsedMs - meanY);
    variance += (s.letters - meanX) ** 2;
  }
  // Все слова одной длины — разделить время на реакцию и печать нельзя.
  if (variance === 0) return DEFAULT_REACTION_MS;
  const slope = covariance / variance;
  if (slope <= 0) return DEFAULT_REACTION_MS;
  const intercept = meanY - slope * meanX;
  return Math.min(MAX_REACTION_MS, Math.max(MIN_REACTION_MS, intercept));
}

export function msPerLetter(sample: SpeedSample, reactionMs: number): number {
  return (
    Math.max(0, sample.elapsedMs - reactionMs) / Math.max(1, sample.letters)
  );
}

export function classifySpeed(
  sample: SpeedSample,
  history: readonly SpeedSample[],
): Speed {
  if (sample.elapsedMs > MAX_ELAPSED_MS) return "slow";
  if (history.length < MIN_SAMPLES_FOR_SPEED) return "normal";
  const reactionMs = estimateReactionMs(history);
  const usual = median(history.map((s) => msPerLetter(s, reactionMs)));
  const current = msPerLetter(sample, reactionMs);
  if (current < usual * FAST_RATIO) return "fast";
  if (current > usual * SLOW_RATIO) return "slow";
  return "normal";
}

/** Добавляет ответ в историю скорости (последние {@link SPEED_HISTORY_SIZE}); слишком долгие не добавляются. */
export function pushSpeedSample(
  history: readonly SpeedSample[],
  sample: SpeedSample,
): SpeedSample[] {
  if (sample.elapsedMs > MAX_ELAPSED_MS) return [...history];
  return [...history, sample].slice(-SPEED_HISTORY_SIZE);
}
