import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasRelease, parseChangelog } from "./changelog.ts";

const SAMPLE = `# История

Вступление.

## 1.2.0 — 2026-10-23

### Добавлено
- Кнопки шрифта.
- Что нового.

### Исправлено
- Пробел.

## 1.1.0 — 2026-10-20

### Изменилось
- Цвета.
`;

describe("история обновлений", () => {
  it("версии по порядку, группы и пункты", () => {
    expect(parseChangelog(SAMPLE)).toEqual([
      {
        version: "1.2.0",
        date: "2026-10-23",
        groups: [
          { title: "Добавлено", items: ["Кнопки шрифта.", "Что нового."] },
          { title: "Исправлено", items: ["Пробел."] },
        ],
      },
      {
        version: "1.1.0",
        date: "2026-10-20",
        groups: [{ title: "Изменилось", items: ["Цвета."] }],
      },
    ]);
  });

  it("запись для версии есть только с пунктами", () => {
    expect(hasRelease(SAMPLE, "1.2.0")).toBe(true);
    expect(hasRelease(SAMPLE, "1.3.0")).toBe(false);
    expect(hasRelease("## 1.3.0 — 2026-10-24\n", "1.3.0")).toBe(false);
  });

  it("в CHANGELOG.md есть запись для текущей версии", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8"));
    expect(hasRelease(readFileSync("CHANGELOG.md", "utf8"), version)).toBe(
      true,
    );
  });
});
