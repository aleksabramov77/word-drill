import { describe, expect, it } from "vitest";
import {
  cellsPerLine,
  firstEmptySlot,
  lengthHint,
  prevSlot,
  splitWord,
  templateAnswer,
  templateWords,
  typeInto,
} from "./template.ts";

const empty = (n: number) => new Array<string>(n).fill("");

describe("шаблон слова", () => {
  it("буквы ложатся по порядку, открытые подсказкой пропускаются", () => {
    // b _ _ o _
    const mask = ["b", null, null, "o", null];
    expect(typeInto(mask, empty(5), 1, "l")).toEqual({
      values: ["", "l", "", "", ""],
      cursor: 2,
    });
    const { values, cursor } = typeInto(mask, empty(5), 1, "lod");
    expect(values).toEqual(["", "l", "o", "", "d"]);
    // Клетки кончились — курсор остаётся на последней.
    expect(cursor).toBe(4);
    expect(templateAnswer(mask, values)).toBe("blood");
  });

  it("ввод с любой клетки заменяет её букву и идёт вправо", () => {
    const mask = [null, null, null];
    expect(typeInto(mask, ["a", "b", "c"], 1, "x")).toEqual({
      values: ["a", "x", "c"],
      cursor: 2,
    });
  });

  it("фраза: пробел переносит в начало следующего слова; знаки игнорируются", () => {
    // b y   f a r
    const mask = [null, null, " ", null, null, null];
    expect(templateWords(mask)).toEqual([
      [0, 1],
      [3, 4, 5],
    ]);
    expect(typeInto(mask, empty(6), 0, "b f!").values).toEqual([
      "b",
      "",
      "",
      "f",
      "",
      "",
    ]);
    const typed = typeInto(mask, empty(6), 0, "byfar");
    expect(templateAnswer(mask, typed.values)).toBe("by far");
  });

  it("пустые клетки в ответ не попадают; назад — к предыдущей клетке", () => {
    const mask = [null, "x", null];
    expect(templateAnswer(mask, ["a", "", ""])).toBe("ax");
    expect(prevSlot(mask, 2)).toBe(0);
    expect(prevSlot(mask, 0)).toBe(-1);
    expect(firstEmptySlot(mask, ["a", "", ""])).toBe(2);
    expect(firstEmptySlot(mask, ["a", "", "b"])).toBe(0);
  });

  it("подсказка длины: слово и фраза", () => {
    expect(lengthHint([null, null, null, null, null])).toBe("5 букв");
    expect(lengthHint([null, null, null, null])).toBe("4 буквы");
    expect(lengthHint([null, null, " ", null, null, null])).toBe(
      "2 слова: 2 + 3 буквы",
    );
    // Апостроф — не буква.
    expect(lengthHint([null, null, null, "'", null])).toBe("4 буквы");
  });
});

describe("перенос длинного слова", () => {
  it("слово, которое влезает в строку, не разбивается", () => {
    expect(splitWord([0, 1, 2], 3)).toEqual([[0, 1, 2]]);
  });
  it("слишком длинное — куски, в конце строки место под знак переноса", () => {
    expect(splitWord([0, 1, 2, 3, 4, 5, 6], 4)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6],
    ]);
  });
  it("клеток в строке по ширине", () => {
    // 343px, клетка 14.4px + 3px промежуток → 19 клеток.
    expect(cellsPerLine(343, 14.4, 3)).toBe(19);
  });
});
