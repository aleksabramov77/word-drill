import { describe, expect, it } from "vitest";
import { untilText } from "./index.ts";

const now = new Date("2026-10-17T09:00:00Z");
const after = (ms: number) => new Date(now.getTime() + ms);

describe("untilText", () => {
  it.each([
    [10_000, "сейчас"],
    [31_000, "через 1 минуту"],
    [59_500, "через 1 минуту"],
    [60_000, "через 1 минуту"],
    [5 * 60_000, "через 5 минут"],
    [22 * 60_000, "через 22 минуты"],
    [3 * 3_600_000, "через 3 часа"],
    [11 * 3_600_000, "через 11 часов"],
    [21 * 86_400_000, "через 21 день"],
  ])("%i мс → %s", (ms, text) => {
    expect(untilText(after(ms), now)).toBe(text);
  });
});
