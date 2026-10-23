import { describe, expect, it } from "vitest";
import { extractEntry, glossParts, mergeEntries } from "./wiktionary.ts";

describe("glossParts", () => {
  it("делит по запятым и «;», выкидывает пояснения в скобках", () => {
    expect(glossParts("(of a person) beautiful, handsome; fine")).toEqual([
      "beautiful",
      "handsome",
      "fine",
    ]);
  });

  it("предлог в скобках — часть перевода", () => {
    expect(glossParts("to take care (of), to look after")).toEqual([
      "to take care of",
      "to look after",
    ]);
  });

  it("длинные описания и не-латиница не берутся", () => {
    expect(
      glossParts("a long explanation of something that is not a word"),
    ).toEqual([]);
    expect(glossParts("genitive singular of кровь")).toEqual([]);
  });
});

describe("extractEntry", () => {
  it("слово с переводами и формами без ударений", () => {
    expect(
      extractEntry({
        word: "кровь",
        pos: "noun",
        senses: [
          { glosses: ["blood"], tags: ["feminine"] },
          { glosses: ["kin"], tags: ["archaic"] },
        ],
        forms: [
          { form: "кро́ви", tags: ["genitive"] },
          { form: "krovʹ", tags: ["romanization"] },
          { form: "кровь", tags: ["nominative"] },
          { form: "кровушка", tags: ["diminutive"] },
          { form: "кровъ", tags: ["alternative"] },
          { form: "буду кровить", tags: ["future"] },
        ],
      }),
    ).toEqual({ ru: "кровь", en: ["blood"], forms: ["крови"] });
  });

  it("форма другого слова и имена — мимо", () => {
    expect(
      extractEntry({
        word: "крови",
        pos: "noun",
        senses: [{ glosses: ["genitive of кровь"], tags: ["form-of"] }],
      }),
    ).toBeNull();
    expect(
      extractEntry({
        word: "Москва",
        pos: "name",
        senses: [{ glosses: ["Moscow"] }],
      }),
    ).toBeNull();
  });
});

describe("mergeEntries", () => {
  it("склеивает части речи одного слова", () => {
    expect(
      mergeEntries([
        { ru: "стекло", en: ["glass"], forms: ["стекла"] },
        { ru: "стекло", en: ["flowed down", "glass"], forms: ["стекла"] },
      ]),
    ).toEqual([
      { ru: "стекло", en: ["glass", "flowed down"], forms: ["стекла"] },
    ]);
  });
});
