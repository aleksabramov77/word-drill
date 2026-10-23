import { describe, expect, it } from "vitest";
import { createTestApp } from "../testing.ts";
import { wordsCsv } from "./export.ts";
import { addWord } from "./service.ts";
import type { WordView } from "./types.ts";

const word = (patch: Partial<WordView>): WordView => ({
  id: 1,
  prompt: "кровь",
  answers: ["blood"],
  source: "manual",
  status: "new",
  hot: false,
  recall: 1,
  knowledge: 0,
  due: "2026-10-17T09:00:00.000Z",
  reps: 0,
  lapses: 0,
  reverse: null,
  createdAt: "2026-10-17T09:00:00.000Z",
  ...patch,
});

describe("wordsCsv", () => {
  it("BOM, заголовок, «;» и местное время", () => {
    const csv = wordsCsv(
      [
        word({
          status: "learning",
          knowledge: 0.426,
          due: "2026-10-20T21:30:00.000Z",
          reverse: {
            status: "learned",
            hot: false,
            knowledge: 0.9,
            due: "2026-11-01T06:00:00.000Z",
          },
        }),
      ],
      "Asia/Tokyo",
    );
    expect(csv.startsWith("﻿По-русски;По-английски;")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "кровь;blood;учится;43;2026-10-21 06:30;выучено;90;2026-11-01 15:00;2026-10-17 18:00",
    );
  });

  it("новое слово — без знания и срока; кавычки и «;» экранируются", () => {
    const csv = wordsCsv(
      [word({ prompt: 'слово; "в кавычках"', answers: ["a", "b"] })],
      "UTC",
    );
    expect(csv.split("\r\n")[1]).toBe(
      '"слово; ""в кавычках""";a, b;новое;;;;;;2026-10-17 09:00',
    );
  });

  it("GET /api/words/export.csv отдаёт файл", async () => {
    const { app, db, userId, clock } = createTestApp();
    addWord(
      db,
      userId,
      { prompt: "вода", answers: ["water"], source: "manual" },
      clock.now(),
    );
    const res = await app.request("/api/words/export.csv");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain(
      'filename="word-drill-2026-10-17.csv"',
    );
    expect(await res.text()).toContain("вода;water;новое");
  });
});
