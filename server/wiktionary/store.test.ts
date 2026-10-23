import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../testing.ts";
import { formatLine } from "./format.ts";
import { openWiktionary, wiktionaryFromLines } from "./store.ts";

const LINES = [
  "# Wiktionary test",
  formatLine({ ru: "кровь", en: ["blood"], forms: ["крови", "кровью"] }),
  formatLine({
    ru: "ущелье",
    en: ["gorge", "ravine", "canyon"],
    forms: ["ущелья"],
  }),
  formatLine({ ru: "кровать", en: ["bed"], forms: [] }),
  formatLine({ ru: "идти", en: ["to go", "to walk"], forms: ["иду"] }),
  formatLine({ ru: "ёж", en: ["hedgehog"], forms: [] }),
];

describe("Викисловарь", () => {
  const dict = wiktionaryFromLines(LINES);

  it("точное русское слово — первым, потом по началу слова", () => {
    expect(dict.size).toBe(5);
    expect(dict.search("кров").map((h) => h.ru)).toEqual(["кровь", "кровать"]);
    expect(dict.search("кровь")[0]).toEqual({ ru: "кровь", en: ["blood"] });
  });

  it("по форме слова: «крови» → кровь", () => {
    expect(dict.search("Крови")[0]).toEqual({
      ru: "кровь",
      en: ["blood"],
      matched: "крови",
    });
  });

  it("ё и е не различаются", () => {
    expect(dict.search("еж")[0]?.ru).toBe("ёж");
  });

  it("по-английски — по переводу, «go» находит «to go»", () => {
    expect(dict.search("ravine")[0]).toMatchObject({
      ru: "ущелье",
      matched: "ravine",
    });
    expect(dict.search("go")[0]).toMatchObject({
      ru: "идти",
      matched: "to go",
    });
  });

  it("файл переносится в базу один раз и заново — когда обновился", () => {
    const dir = mkdtempSync(join(tmpdir(), "wikt-"));
    const source = join(dir, "w.tsv.gz");
    const db = join(dir, "w.db");
    writeFileSync(source, gzipSync(LINES.join("\n")));
    expect(openWiktionary(source, db).size).toBe(5);
    expect(openWiktionary(source, db).search("ущелья")[0]?.ru).toBe("ущелье");
    writeFileSync(source, gzipSync(LINES.slice(0, 2).join("\n")));
    expect(openWiktionary(source, db).size).toBe(1);
  });

  it("нет файла — пустой словарь", () => {
    expect(openWiktionary("/nonexistent/w.tsv.gz", ":memory:").size).toBe(0);
  });

  it("GET /api/dictionary/wiktionary", async () => {
    const { app } = createTestApp({ wiktionary: dict });
    const res = await app.request("/api/dictionary/wiktionary?q=ущел");
    expect(res.status).toBe(200);
    expect((await res.json()).hits[0]).toEqual({
      ru: "ущелье",
      en: ["gorge", "ravine", "canyon"],
    });
  });
});
