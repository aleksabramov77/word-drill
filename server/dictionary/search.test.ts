import { describe, expect, it } from "vitest";
import { fixtureDictionary } from "./fixture.ts";
import { searchDictionary, unitWords } from "./index.ts";

const en = (q: string) =>
  searchDictionary(fixtureDictionary, q).map((hit) => hit.word.en);

describe("searchDictionary", () => {
  it("кровь → blood первым", () => {
    const [first] = searchDictionary(fixtureDictionary, "кровь");
    expect(first?.word.en).toBe("blood");
    expect(first?.matched).toBe("кровь");
  });

  it("по латинице ищет в английских словах, точное выше начала", () => {
    expect(en("blood")).toEqual(["blood", "blood pressure", "bloody"]);
  });

  it("ё = е, регистр не важен", () => {
    expect(en("ЛЕД")).toEqual(["ice"]);
  });

  it("вхождение внутри фразы", () => {
    expect(en("давление")).toEqual(["blood pressure"]);
  });

  it("удалённое из курса слово ниже", () => {
    expect(en("кров")).toEqual(["blood", "blood pressure", "bloody"]);
  });

  it("пустой запрос и лимит", () => {
    expect(en("  ")).toEqual([]);
    expect(searchDictionary(fixtureDictionary, "b", 1)).toHaveLength(1);
  });
});

describe("unitWords", () => {
  it("слова юнита", () => {
    expect(unitWords(fixtureDictionary, 1).map((w) => w.en)).toEqual([
      "coffee",
      "ice",
      "milk",
    ]);
  });
});
