import { describe, expect, it } from "vitest";
import { filterUnits } from "./units.ts";

const UNITS = [
  { n: 3, title: "Family", goal: "Представь членов семьи" },
  { n: 55, title: "Problems", goal: "Возвращай бракованный товар" },
  { n: 159, title: "Marriage", goal: "Брак: Опиши подготовку к свадьбе" },
  { n: 200, title: "Hedgehogs", goal: "Расскажи о ёжиках" },
];

describe("filterUnits", () => {
  it("пустой запрос — все темы", () => {
    expect(filterUnits(UNITS, "  ")).toHaveLength(4);
  });

  it("по русской цели без учёта регистра", () => {
    expect(filterUnits(UNITS, "Брак").map((u) => u.n)).toEqual([55, 159]);
  });

  it("по английскому названию", () => {
    expect(filterUnits(UNITS, "marri").map((u) => u.n)).toEqual([159]);
  });

  it("ё и е — одно и то же", () => {
    expect(filterUnits(UNITS, "ежик").map((u) => u.n)).toEqual([200]);
  });

  it("число — точный номер темы", () => {
    expect(filterUnits(UNITS, "55").map((u) => u.n)).toEqual([55]);
  });
});
