import { beforeEach, describe, expect, it } from "vitest";
import { useAnswerStore } from "./store.ts";

describe("состояние показа", () => {
  beforeEach(() => useAnswerStore.getState().start(1, 1000));

  it("ввод неверно → выбор с вариантами → показ → готово", () => {
    const { apply } = useAnswerStore.getState();
    apply({
      verdict: "wrong",
      correct: false,
      expected: "blood",
      next: "choice",
      options: ["a", "blood"],
    });
    expect(useAnswerStore.getState()).toMatchObject({
      stage: "choice",
      options: ["a", "blood"],
      done: null,
    });

    apply({ correct: false, expected: "blood", next: "show" });
    expect(useAnswerStore.getState()).toMatchObject({
      stage: "show",
      options: ["a", "blood"],
    });

    apply({ correct: true, expected: "blood", next: "done" });
    expect(useAnswerStore.getState().done?.next).toBe("done");
    expect(useAnswerStore.getState().stage).toBe("show");
  });

  it("новое слово сбрасывает состояние", () => {
    useAnswerStore
      .getState()
      .apply({ correct: true, expected: "x", next: "done" });
    useAnswerStore.getState().start(2, 5000);
    expect(useAnswerStore.getState()).toMatchObject({
      wordId: 2,
      stage: "type",
      shownAt: 5000,
      done: null,
      last: null,
    });
  });
});
