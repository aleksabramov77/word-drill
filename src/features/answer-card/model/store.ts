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
  options: [],
  done: null,
  start: (wordId, now = Date.now()) =>
    set({
      wordId,
      stage: "type",
      shownAt: now,
      last: null,
      options: [],
      done: null,
    }),
  apply: (result) =>
    set((state) => ({
      last: result,
      stage: result.next === "done" ? state.stage : result.next,
      options: result.options ?? state.options,
      done: result.next === "done" ? result : null,
    })),
}));
