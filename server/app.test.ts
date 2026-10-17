import { describe, expect, it } from "vitest";
import { createTestApp } from "./testing.ts";

const json = (data: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

describe("api", () => {
  it("отвечает на /api/health", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
    });
  });

  it("ищет в словаре", async () => {
    const { app } = createTestApp();
    const res = await app.request(
      `/api/dictionary/search?q=${encodeURIComponent("кровь")}&limit=1`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hits).toHaveLength(1);
    expect(body.hits[0].word.en).toBe("blood");
  });

  it("отклоняет неверный лимит", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/dictionary/search?q=a&limit=0");
    expect(res.status).toBe(400);
  });

  it("отдаёт юниты и слова юнита", async () => {
    const { app } = createTestApp();
    const units = await (await app.request("/api/dictionary/units")).json();
    expect(units.units).toHaveLength(2);
    const unit = await (await app.request("/api/dictionary/units/1")).json();
    expect(unit.unit.title).toBe("Home Visit");
    expect(unit.words).toHaveLength(3);
    expect((await app.request("/api/dictionary/units/99")).status).toBe(404);
  });

  it("слова: добавить, дубль, список, удалить", async () => {
    const { app } = createTestApp();
    const created = await app.request(
      "/api/words",
      json({ prompt: "кровь", answers: ["blood"], source: "dictionary" }),
    );
    expect(created.status).toBe(201);
    const { word } = await created.json();
    expect(word.status).toBe("new");

    const again = await app.request(
      "/api/words",
      json({ prompt: "кровь", answers: ["blood"] }),
    );
    expect(again.status).toBe(409);
    expect(
      (await app.request("/api/words", json({ prompt: "", answers: [] })))
        .status,
    ).toBe(400);

    const list = await (await app.request("/api/words")).json();
    expect(list.words).toHaveLength(1);

    const patched = await app.request(`/api/words/${word.id}`, {
      ...json({ answers: ["blood", "gore"] }),
      method: "PATCH",
    });
    expect((await patched.json()).word.answers).toEqual(["blood", "gore"]);

    expect(
      (await app.request(`/api/words/${word.id}`, { method: "DELETE" })).status,
    ).toBe(204);
    expect(
      (await app.request(`/api/words/${word.id}`, { method: "DELETE" })).status,
    ).toBe(404);
  });

  it("тренировка: очередь и шаг лестницы", async () => {
    const { app } = createTestApp();
    await app.request(
      "/api/words",
      json({ prompt: "кровь", answers: ["blood"] }),
    );
    const queue = await (await app.request("/api/drill/next")).json();
    expect(queue.card.prompt).toBe("кровь");

    const step = await app.request(
      `/api/drill/${queue.card.wordId}/step`,
      json({ stage: "type", input: "blood", elapsedMs: 2500 }),
    );
    const result = await step.json();
    expect(result.verdict).toBe("correct");
    expect(result.next).toBe("done");

    expect(
      (
        await app.request(
          "/api/drill/999/step",
          json({ stage: "type", input: "x" }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request(
          "/api/drill/1/step",
          json({ stage: "fly", input: "x" }),
        )
      ).status,
    ).toBe(400);
  });
});
