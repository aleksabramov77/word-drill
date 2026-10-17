import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

describe("api", () => {
  it("отвечает на /api/health", async () => {
    const res = await createApp().request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
