import {
  type Card,
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
} from "ts-fsrs";
import type { ReviewGrade } from "./ladder.ts";

/**
 * «Горячий круг» — шаги обучения FSRS: невспомненное слово возвращается через 1 → 5 → 15 минут.
 * Again сбрасывает на первый шаг, Hard оставляет на месте, Good/Easy двигают дальше — к интервалам в днях.
 */
export const HOT_STEPS = ["1m", "5m", "15m"] as const;

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365,
    enable_fuzz: true,
    learning_steps: [...HOT_STEPS],
    relearning_steps: [...HOT_STEPS],
  }),
);

export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

export function reviewCard(card: Card, grade: ReviewGrade, now: Date): Card {
  return scheduler.next(card, now, grade).card;
}

/** Вероятность вспомнить слово сейчас (0…1); новое слово — 0. */
export function recallProbability(card: Card, now: Date): number {
  if (card.state === State.New) return 0;
  return scheduler.get_retrievability(card, now, false);
}

export function isHot(card: Card): boolean {
  return card.state === State.Learning || card.state === State.Relearning;
}

export type WordStatus = "new" | "learning" | "errors" | "learned";

const LEARNED_STABILITY_DAYS = 21;

/**
 * «Знание» слова 0…1 — прочность памяти FSRS (сколько дней слово держится), 21 день и больше — 100%.
 * Не вероятность вспомнить: сразу после показа она всегда ~100%, даже если слово только что не вспомнилось.
 * В горячем круге FSRS прочность не меняет (повторы в тот же день её почти не растят), поэтому там
 * знание растёт по пройденным шагам: Good двигает шаг, Hard оставляет, Again сбрасывает на начало.
 */
export function knowledge(card: Card): number {
  if (card.state === State.New) return 0;
  const strength = Math.min(1, card.stability / LEARNED_STABILITY_DAYS);
  if (!isHot(card)) return strength;
  return (strength * (card.learning_steps + 1)) / (HOT_STEPS.length + 1);
}

/** Статус слова в списке: новое → учится → с ошибками (вспоминается, но с опечаткой или долго) → выучено. */
export function wordStatus(card: Card, lastGrade?: ReviewGrade): WordStatus {
  if (card.state === State.New) return "new";
  if (lastGrade === Rating.Hard) return "errors";
  if (card.state === State.Review && card.stability >= LEARNED_STABILITY_DAYS) {
    return "learned";
  }
  return "learning";
}

export { type Card, Rating, State };
