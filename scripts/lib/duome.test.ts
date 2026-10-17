import { describe, expect, it } from "vitest";
import {
  buildDictionary,
  parseAlphabetical,
  parseSkills,
  parseTranslations,
} from "./duome.ts";

const word = (en: string, ru: string, classes = " ") =>
  `<li class="${classes}"><div class="playback voice speak xs " data-src="https://x/y"></div> <span class="_blue  wA">${en}</span><span class="cCCC wT"> - ${ru}</span></li>`;
const letter = (l: string) =>
  `<li class="single"><div class="path-section-delimiter"><hr><span title="${l}">${l}</span><hr></div></li>`;
const unit = (n: number, title: string, goal: string) =>
  `<li class="single"><a name="s${n}"></a><div class="path-section-delimiter"><hr><span title="abc">${n} <span class="small-label">${title}</span> ${goal}</span><hr></div></li>`;

const alphabetical = `<div id="words"><ul class="plain list ">${letter("b")}${word("blood", "кровь")}${word("blocked", "засорён, заблокирован", " missing")}${letter("c")}${word("coffee", "кофе")}${word("and", "а, и, н, a, and, причём")}${word("2020", "2020")}</ul></div>`;
const skills = `<div id="words"><ul class="plain list ">${unit(1, "Home Visit", "Предложи или прими напиток")}${word("coffee", "кофе")}${word("milk", "молоко")}${unit(2, "Health", "Поговори о здоровье")}${word("blood", "кровь")}${word("milk", "молоко")}</ul></div>`;

describe("parseTranslations", () => {
  it("оставляет только русские формы длиной от 2 букв, без повторов", () => {
    expect(
      parseTranslations(" - а, и, н, a, and, причём, причём, I&#039;m"),
    ).toEqual(["причём"]);
  });
});

describe("parseAlphabetical", () => {
  it("разбирает слова и пометку missing, пропускает заголовки букв", () => {
    expect(parseAlphabetical(alphabetical)).toEqual([
      { en: "blood", ru: ["кровь"], missing: false },
      { en: "blocked", ru: ["засорён", "заблокирован"], missing: true },
      { en: "coffee", ru: ["кофе"], missing: false },
      { en: "and", ru: ["причём"], missing: false },
      { en: "2020", ru: [], missing: false },
    ]);
  });
});

describe("parseSkills", () => {
  it("разбирает юниты и юниты каждого слова", () => {
    const parsed = parseSkills(skills);
    expect(parsed.units).toEqual([
      { n: 1, title: "Home Visit", goal: "Предложи или прими напиток" },
      { n: 2, title: "Health", goal: "Поговори о здоровье" },
    ]);
    expect(parsed.wordUnits.get("milk")).toEqual([1, 2]);
    expect(parsed.wordUnits.get("blood")).toEqual([2]);
  });
});

describe("buildDictionary", () => {
  it("объединяет алфавит и юниты, выкидывает слова без русских переводов", () => {
    const dictionary = buildDictionary(
      parseAlphabetical(alphabetical),
      parseSkills(skills),
      "test",
      new Date("2026-10-17T00:00:00Z"),
    );
    expect(dictionary.words.map((w) => w.en)).toEqual([
      "and",
      "blocked",
      "blood",
      "coffee",
      "milk",
    ]);
    expect(dictionary.words.find((w) => w.en === "blood")?.units).toEqual([2]);
    expect(dictionary.words.find((w) => w.en === "blocked")?.units).toEqual([]);
    expect(dictionary.units).toHaveLength(2);
  });
});
