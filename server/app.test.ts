import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { fixtureDictionary } from "./dictionary/fixture.ts";

const app = createApp({ dictionary: fixtureDictionary });

describe("api", () => {
  it("отвечает на /api/health", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("ищет в словаре", async () => {
    const res = await app.request(
      `/api/dictionary/search?q=${encodeURIComponent("кровь")}&limit=1`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hits).toHaveLength(1);
    expect(body.hits[0].word.en).toBe("blood");
  });

  it("отклоняет неверный лимит", async () => {
    const res = await app.request("/api/dictionary/search?q=a&limit=0");
    expect(res.status).toBe(400);
  });

  it("отдаёт юниты и слова юнита", async () => {
    const units = await (await app.request("/api/dictionary/units")).json();
    expect(units.units).toHaveLength(2);
    const unit = await (await app.request("/api/dictionary/units/1")).json();
    expect(unit.unit.title).toBe("Home Visit");
    expect(unit.words).toHaveLength(3);
    expect((await app.request("/api/dictionary/units/99")).status).toBe(404);
  });
});
