import { Rating } from "ts-fsrs";
import type { Verdict } from "../answer-check/index.ts";
import type { Speed } from "./speed.ts";

/**
 * Лестница одного показа слова — от трудного к лёгкому:
 * ввод (вспомнить самому) → подсказки по буквам (вспомнить с подсказкой) → выбор из вариантов (узнать)
 * → показ ответа, который надо переписать.
 */
export type Stage = "type" | "hint" | "choice" | "show";

export const STAGE_DEPTH: Record<Stage, number> = {
  type: 0,
  hint: 1,
  choice: 2,
  show: 3,
};

export function deeperStage(a: Stage, b: Stage): Stage {
  return STAGE_DEPTH[a] >= STAGE_DEPTH[b] ? a : b;
}

export type StageResult =
  | { stage: "type"; verdict: Verdict }
  /** exhausted — подсказок больше не дать или открыто больше половины, а ответа нет; giveUp — «Варианты». */
  | { stage: "hint"; correct: boolean; exhausted: boolean; giveUp?: boolean }
  | { stage: "choice" | "show"; correct: boolean };

export function nextStage(result: StageResult): Stage | "done" {
  switch (result.stage) {
    case "type":
      return result.verdict === "correct" || result.verdict === "typo"
        ? "done"
        : "hint";
    case "hint":
      if (result.correct) return "done";
      return result.giveUp || result.exhausted ? "choice" : "hint";
    case "choice":
      return result.correct ? "done" : "show";
    case "show":
      return result.correct ? "done" : "show";
  }
}

export type ReviewGrade =
  | Rating.Again
  | Rating.Hard
  | Rating.Good
  | Rating.Easy;

/** До этой доли открытых букв ответ с подсказкой — Hard, больше — Again. */
export const HARD_HINT_SHARE = 0.25;

export interface AttemptSummary {
  /** Результат ввода — первого шага. */
  first: StageResult;
  /** Самый нижний шаг лестницы, до которого дошли. */
  deepest: Stage;
  /** Сколько букв открыто подсказками. */
  revealed: number;
  letters: number;
}

/**
 * Итог показа → оценка FSRS:
 * - ввод: верно и быстро — Easy, верно — Good, медленно или с опечаткой — Hard;
 * - подсказки: только заготовка или открыто ≤ 25% букв — Hard, больше — Again;
 * - выбор или показ — Again.
 */
export function gradeAttempt(
  { first, deepest, revealed, letters }: AttemptSummary,
  speed: Speed,
): ReviewGrade {
  if (deepest === "choice" || deepest === "show") return Rating.Again;
  if (deepest === "hint") {
    return revealed / Math.max(1, letters) <= HARD_HINT_SHARE
      ? Rating.Hard
      : Rating.Again;
  }
  if (first.stage !== "type") return Rating.Again;
  switch (first.verdict) {
    case "correct":
      if (speed === "fast") return Rating.Easy;
      return speed === "slow" ? Rating.Hard : Rating.Good;
    case "typo":
      return Rating.Hard;
    default:
      return Rating.Again;
  }
}
