import { describe, expect, it } from "vitest";
import { isIos, vapidKeyToBytes } from "./support.ts";

describe("уведомления: поддержка", () => {
  it("узнаёт iPhone и iPad (в том числе iPadOS с видом Mac)", () => {
    expect(
      isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)", 5),
    ).toBe(true);
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(
      true,
    );
    expect(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(
      false,
    );
    expect(isIos("Mozilla/5.0 (Linux; Android 15)", 5)).toBe(false);
  });

  it("base64url-ключ → байты", () => {
    expect([...vapidKeyToBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});
