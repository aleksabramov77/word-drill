import { describe, expect, it } from "vitest";
import { diffChars } from "./index.ts";

describe("diffChars", () => {
  it("пропущенная буква", () => {
    expect(diffChars("blod", "blood")).toEqual([
      { kind: "same", text: "blo" },
      { kind: "missing", text: "o" },
      { kind: "same", text: "d" },
    ]);
  });

  it("лишняя и неверная буквы", () => {
    expect(diffChars("bluod", "blood")).toEqual([
      { kind: "same", text: "bl" },
      { kind: "extra", text: "u" },
      { kind: "same", text: "o" },
      { kind: "missing", text: "o" },
      { kind: "same", text: "d" },
    ]);
  });

  it("регистр не считается ошибкой, показываем правильное написание", () => {
    expect(diffChars("BLOOD", "blood")).toEqual([
      { kind: "same", text: "blood" },
    ]);
  });
});
