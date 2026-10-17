import type { Dictionary } from "./schema.ts";

/** Маленький словарь для тестов. */
export const fixtureDictionary: Dictionary = {
  source: "test",
  importedAt: "2026-10-17T00:00:00.000Z",
  units: [
    { n: 1, title: "Home Visit", goal: "Предложи или прими напиток" },
    { n: 2, title: "Health", goal: "Поговори о здоровье" },
  ],
  words: [
    { en: "blood", ru: ["кровь", "крови"], units: [2], missing: false },
    {
      en: "blood pressure",
      ru: ["кровяное давление", "артериальное давление"],
      units: [2],
      missing: false,
    },
    { en: "bloody", ru: ["кровавый"], units: [], missing: true },
    { en: "coffee", ru: ["кофе"], units: [1], missing: false },
    { en: "ice", ru: ["лёд", "льда"], units: [1], missing: false },
    { en: "milk", ru: ["молоко", "молока"], units: [1, 2], missing: false },
    // Синонимы: у одних русских слов несколько английских переводов.
    {
      en: "by far",
      ru: ["значительно", "гораздо", "намного", "далеко"],
      units: [3],
      missing: false,
    },
    { en: "a lot", ru: ["гораздо", "много"], units: [3], missing: false },
    { en: "far", ru: ["далеко", "дальний"], units: [3], missing: false },
  ],
};
