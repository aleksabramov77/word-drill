import { describe, expect, it } from "vitest";
import { fixtureDictionary } from "./fixture.ts";
import { otherForms, synonymsOf } from "./translations.ts";

describe("переводы по словарю", () => {
  it("другие русские формы слова — без главной (ё и регистр не важны)", () => {
    expect(otherForms(fixtureDictionary, "by far", "Гораздо")).toEqual([
      "значительно",
      "намного",
      "далеко",
    ]);
    expect(otherForms(fixtureDictionary, "ice", "лед")).toEqual(["льда"]);
    expect(otherForms(fixtureDictionary, "нет такого", "x")).toEqual([]);
  });

  it("синонимы — другие переводы показанных форм, без своих ответов", () => {
    expect(
      synonymsOf(fixtureDictionary, ["гораздо", "далеко"], ["by far"]).sort(),
    ).toEqual(["a lot", "far"]);
    expect(synonymsOf(fixtureDictionary, ["кровь"], ["blood"])).toEqual([]);
  });
});
