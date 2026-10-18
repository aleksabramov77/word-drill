import { describe, expect, it } from "vitest";
import {
  hintLetters,
  knownLetters,
  maskAnswer,
  nextHintIndex,
} from "./index.ts";

describe("подсказки по буквам", () => {
  it("считает только буквы", () => {
    expect(hintLetters("frustration")).toBe(11);
    expect(hintLetters("ice-cream")).toBe(8);
    expect(hintLetters("I'm fine")).toBe(6);
  });

  it("заготовка: буквы скрыты, пробелы и знаки видны", () => {
    expect(maskAnswer("a cup", [])).toEqual([null, " ", null, null, null]);
    expect(maskAnswer("don't", [0])).toEqual(["d", null, null, "'", null]);
  });

  it("сначала первые буквы слов по порядку, потом случайные", () => {
    const answer = "a cup of tea";
    const order: number[] = [];
    for (let k = 0; k < 4; k++) {
      const next = nextHintIndex(answer, order, () => 0);
      if (next === null) break;
      order.push(next);
    }
    expect(order).toEqual([0, 2, 6, 9]);
    expect(nextHintIndex(answer, order, () => 0)).toBe(3);
  });

  it("верно вписанные буквы не открывает — открывает другую свободную", () => {
    // b l o o d: вписаны «b» и «o» на своих местах, «x» — мимо.
    const known = knownLetters("blood", ["B", "x", "o", "", ""]);
    expect(known).toEqual([0, 2]);
    // Первая буква слова уже известна — следующая открывается среди неизвестных.
    expect(nextHintIndex("blood", [], () => 0, known)).toBe(1);
    // Неизвестной осталась одна — её не открываем.
    expect(nextHintIndex("blood", [1], () => 0, [0, 2, 3])).toBeNull();
  });

  it("последнюю скрытую букву не открывает", () => {
    expect(nextHintIndex("cat", [0, 1])).toBeNull();
    expect(nextHintIndex("a", [])).toBeNull();
  });
});
