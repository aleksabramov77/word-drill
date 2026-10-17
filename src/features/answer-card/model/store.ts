import { create } from "zustand";
import type { Stage, StepResult } from "./types.ts";

interface AnswerState {
  wordId: number | null;
  /** Шаг лестницы, на который сейчас отвечаем. */
  stage: Stage;
  /** Когда показали слово — от этого считается скорость ввода. */
  shownAt: number;
  /** Последний ответ сервера: вердикт, правильное слово, варианты. */
  last: StepResult | null;
  /** Заготовка для подсказок (null — скрытая буква). */
  mask: (string | null)[];
  /** Сколько букв открыто подсказками. */
  revealed: number;
  /** Уровень подсказки: 1 — число букв, 2 — шаблон. */
  hintLevel: 1 | 2;
  options: string[];
  /** Показ закончен — ждём «Дальше». */
  done: StepResult | null;
  start: (wordId: number, now?: number) => void;
  apply: (result: StepResult) => void;
}

export const useAnswerStore = create<AnswerState>((set) => ({
  wordId: null,
  stage: "type",
  shownAt: 0,
  last: null,
  mask: [],
  revealed: 0,
  hintLevel: 1,
  options: [],
  done: null,
  start: (wordId, now = Date.now()) =>
    set({
      wordId,
      stage: "type",
      shownAt: now,
      last: null,
      mask: [],
      revealed: 0,
      hintLevel: 1,
      options: [],
      done: null,
    }),
  apply: (result) =>
    set((state) => ({
      last: result,
      stage: result.next === "done" ? state.stage : result.next,
      mask: result.mask ?? state.mask,
      revealed: result.revealed ?? state.revealed,
      hintLevel: result.hintLevel ?? state.hintLevel,
      options: result.options ?? state.options,
      done: result.next === "done" ? result : null,
    })),
}));
