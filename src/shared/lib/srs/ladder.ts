import { Rating } from "ts-fsrs";
import type { Verdict } from "../answer-check/index.ts";
import type { Speed } from "./speed.ts";

/**
 * Лестница одного показа слова:
 * ввод → (далеко от правильного) выбор из вариантов → (и тут ошибка) показ ответа, который надо переписать.
 */
export type Stage = "type" | "choice" | "show";

export type StageResult =
  | { stage: "type"; verdict: Verdict }
  | { stage: "choice" | "show"; correct: boolean };

export function nextStage(result: StageResult): Stage | "done" {
  switch (result.stage) {
    case "type":
      return result.verdict === "correct" || result.verdict === "typo"
        ? "done"
        : "choice";
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

/**
 * Итог показа → оценка FSRS. Вниз по лестнице (выбор, показ) — Again: слово не вспомнилось само.
 * Ввод с опечаткой или медленный — Hard, верный — Good, верный и быстрый — Easy.
 */
export function gradeAttempt(first: StageResult, speed: Speed): ReviewGrade {
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
