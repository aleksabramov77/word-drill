import { describe, expect, it } from "vitest";
import { letterSimilarity, pickDistractors, shuffle } from "./index.ts";

// Детерминированный генератор для тестов (LCG).
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe("letterSimilarity", () => {
  it("одинаковые — 1, без общих пар — 0", () => {
    expect(letterSimilarity("blood", "blood")).toBe(1);
    expect(letterSimilarity("abc", "xyz")).toBe(0);
  });

  it("blood ближе к flood, чем к table", () => {
    expect(letterSimilarity("blood", "flood")).toBeGreaterThan(
      letterSimilarity("blood", "table"),
    );
  });
});

describe("shuffle", () => {
  it("переставляет, не теряя элементов", () => {
    const items = [1, 2, 3, 4, 5];
    expect(shuffle(items, seeded(1)).sort()).toEqual(items);
  });
});

describe("pickDistractors", () => {
  const pool = [
    "blood",
    "Blood",
    "flood",
    "blond",
    "bloom",
    "block",
    "elephant",
    "university",
    "a",
    "",
  ];

  it("не включает сам ответ и повторы, отдаёт нужное число", () => {
    const result = pickDistractors("blood", pool, 3, seeded(7));
    expect(result).toHaveLength(3);
    expect(result).not.toContain("blood");
    expect(result).not.toContain("Blood");
    expect(new Set(result).size).toBe(3);
  });

  it("предпочитает похожие слова", () => {
    const similar = ["flood", "blond", "bloom", "block"];
    const result = pickDistractors(
      "blood",
      [...similar, ...Array.from({ length: 20 }, (_, i) => `zzzzzzzz${i}`)],
      3,
      seeded(3),
    );
    expect(
      result.filter((w) => similar.includes(w)).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("маленький словарь — сколько есть", () => {
    expect(pickDistractors("blood", ["flood"], 3)).toEqual(["flood"]);
  });
});
