import { describe, expect, it } from "vitest";
import {
  allowedTypos,
  areAdjacentKeys,
  canonicalSpelling,
  checkAnswer,
  normalize,
  typoDistance,
} from "./index.ts";

describe("normalize", () => {
  it.each([
    ["  The   Boy! ", "the boy"],
    ["Don’t", "don't"],
    ["ice-cream", "ice cream"],
    ["Ёлка", "елка"],
  ])("%j → %j", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("canonicalSpelling", () => {
  it.each([
    ["colour", "color"],
    ["centre", "center"],
    ["realise", "realize"],
    ["organisation", "organization"],
    ["analyse", "analyze"],
    ["catalogue", "catalog"],
    ["hour", "hour"],
    ["four", "four"],
  ])("%s → %s", (input, expected) => {
    expect(canonicalSpelling(input)).toBe(expected);
  });
});

describe("typoDistance", () => {
  it("соседняя клавиша — пол-ошибки, дальняя — целая", () => {
    expect(areAdjacentKeys("a", "s")).toBe(true);
    expect(areAdjacentKeys("a", "q")).toBe(true);
    expect(areAdjacentKeys("a", "z")).toBe(true);
    expect(areAdjacentKeys("a", "p")).toBe(false);
    expect(typoDistance("cst", "cat")).toBe(0.5);
    expect(typoDistance("cpt", "cat")).toBe(1);
  });

  it("перестановка соседних букв — одна ошибка", () => {
    expect(typoDistance("recieve", "receive")).toBe(1);
  });

  it("пропуск и лишняя буква — по одной ошибке", () => {
    expect(typoDistance("blod", "blood")).toBe(1);
    expect(typoDistance("bloood", "blood")).toBe(1);
  });
});

describe("allowedTypos", () => {
  it.each([
    [2, 0],
    [3, 0.5],
    [4, 0.5],
    [5, 1],
    [8, 1],
    [9, 2],
  ])("%i букв → %d", (letters, allowed) => {
    expect(allowedTypos(letters)).toBe(allowed);
  });
});

describe("checkAnswer", () => {
  it.each([
    ["blood", ["blood"], "correct"],
    ["Blood!", ["blood"], "correct"],
    ["the boy", ["boy"], "correct"],
    ["boy", ["the boy"], "correct"],
    ["to run", ["run"], "correct"],
    ["colour", ["color"], "correct"],
    ["color", ["colour"], "correct"],
    ["blod", ["blood"], "typo"],
    ["cst", ["cat"], "typo"],
    ["accomodation", ["accommodation"], "typo"],
    ["acomodation", ["accommodation"], "typo"],
    ["cot", ["cat"], "partial"],
    ["bloud", ["blood"], "typo"],
    ["brod", ["blood"], "partial"],
    ["water", ["blood"], "wrong"],
    ["", ["blood"], "wrong"],
    ["   ", ["blood"], "wrong"],
  ] as const)("%j для %j → %s", (input, accepted, verdict) => {
    expect(checkAnswer(input, accepted).verdict).toBe(verdict);
  });

  it("выбирает ближайший из допустимых вариантов", () => {
    const result = checkAnswer("bikr", ["bicycle", "bike"]);
    expect(result.verdict).toBe("typo");
    expect(result.expected).toBe("bike");
  });

  it("пропуск буквы в коротком слове — уже не опечатка", () => {
    expect(checkAnswer("bik", ["bike"]).verdict).toBe("partial");
  });

  it("узнаёт перевод другого слова из списка", () => {
    expect(checkAnswer("water", ["blood"], ["water", "milk"]).verdict).toBe(
      "other-word",
    );
  });

  it("опечатка важнее совпадения с другим словом", () => {
    expect(checkAnswer("bloed", ["blood"], ["bloed"]).verdict).toBe("typo");
  });

  it("без правильных ответов — ошибка программы", () => {
    expect(() => checkAnswer("x", [])).toThrow();
  });
});

describe("синонимы", () => {
  it("другой верный перевод — synonym, а не ошибка; свой ответ важнее", () => {
    const synonym = (input: string) =>
      checkAnswer(input, ["by far"], [], ["a lot", "way"]).verdict;
    expect(synonym("a lot")).toBe("synonym");
    expect(synonym("lot")).toBe("synonym");
    expect(synonym("Way")).toBe("synonym");
    expect(synonym("by far")).toBe("correct");
    expect(synonym("a lto")).toBe("wrong");
  });
});
