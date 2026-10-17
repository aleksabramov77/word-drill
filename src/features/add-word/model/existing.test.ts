import { describe, expect, it } from "vitest";
import type { Word } from "@/entities/word";
import { findExisting, wordsByAnswer } from "./existing.ts";

const word = (id: number, prompt: string, answers: string[]): Word => ({
  id,
  prompt,
  answers,
  source: "manual",
  status: "new",
  hot: false,
  recall: 0,
  knowledge: 0,
  due: "2026-10-17T00:00:00.000Z",
  reps: 0,
  lapses: 0,
  createdAt: "2026-10-17T00:00:00.000Z",
});

const words = [
  word(1, "Кровь", ["blood"]),
  word(2, "велосипед", ["bike", "bicycle"]),
];

describe("уже добавленные слова", () => {
  it("по английскому ответу (без регистра и знаков)", () => {
    const map = wordsByAnswer(words);
    expect(map.get("bicycle")?.id).toBe(2);
    expect(map.get("blood")?.id).toBe(1);
  });

  it("та же карточка — по русскому слову; тот же ответ под другим словом — отдельно", () => {
    expect(findExisting(words, " кровь ", ["gore"])).toEqual({
      kind: "same-prompt",
      word: words[0],
    });
    expect(findExisting(words, "байк", ["Bike"])).toEqual({
      kind: "same-answer",
      word: words[1],
    });
    expect(findExisting(words, "вода", ["water"])).toBeNull();
  });
});
