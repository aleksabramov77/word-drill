import { describe, expect, it } from "vitest";
import { compareVersions, parseVersion } from "./semver.ts";

describe("версии", () => {
  it("разбирает major.minor.patch", () => {
    expect(parseVersion("1.0.0")).toEqual([1, 0, 0]);
    expect(parseVersion("12.3.45")).toEqual([12, 3, 45]);
  });

  it("не принимает другие форматы", () => {
    for (const bad of ["1.0", "v1.0.0", "1.0.0-beta", "a.b.c", ""]) {
      expect(() => parseVersion(bad)).toThrow();
    }
  });

  it("сравнивает по числам, а не по строкам", () => {
    expect(compareVersions("1.0.1", "1.0.0")).toBeGreaterThan(0);
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.9.0", "1.0.0")).toBeLessThan(0);
  });
});
