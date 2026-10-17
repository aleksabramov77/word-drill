import { describe, expect, it } from "vitest";
import { manualWordSchema, splitAnswers, toNewWord } from "./manualWord.ts";

describe("ручное добавление", () => {
  it("варианты через запятую, точку с запятой или с новой строки", () => {
    expect(splitAnswers(" bike, bicycle;cycle\n ,")).toEqual([
      "bike",
      "bicycle",
      "cycle",
    ]);
  });

  it("проверяет поля", () => {
    expect(
      manualWordSchema.safeParse({ prompt: " ", answers: "x" }).success,
    ).toBe(false);
    expect(
      manualWordSchema.safeParse({ prompt: "кровь", answers: " , " }).success,
    ).toBe(false);
    const ok = manualWordSchema.parse({
      prompt: " кровь ",
      answers: "blood, gore",
    });
    expect(toNewWord(ok)).toEqual({
      prompt: "кровь",
      answers: ["blood", "gore"],
      source: "manual",
    });
  });
});
