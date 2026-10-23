import { describe, expect, it } from "vitest";
import { Rating } from "../../src/shared/lib/srs/index.ts";
import { reviews } from "../db/schema.ts";
import { addWord } from "../drill/service.ts";
import { createTestApp } from "../testing.ts";
import { STATS_DAYS, userStats } from "./service.ts";

const DAY = 86_400_000;

function setup() {
  // 2026-10-17 09:00 UTC; часовой пояс по умолчанию — UTC.
  const ctx = createTestApp();
  const add = (prompt: string, answer: string) => {
    const word = addWord(
      ctx.db,
      ctx.userId,
      { prompt, answers: [answer], source: "manual" },
      ctx.clock.now(),
    );
    if (word === "duplicate") throw new Error("duplicate");
    return word;
  };
  const review = (
    wordId: number,
    daysAgo: number,
    deepest: "type" | "hint" | "choice" | "show",
    grade: number,
  ) =>
    ctx.db
      .insert(reviews)
      .values({
        userId: ctx.userId,
        wordId,
        at: new Date(ctx.clock.now().getTime() - daysAgo * DAY),
        first: {},
        deepest,
        grade,
      })
      .run();
  return { ...ctx, add, review };
}

describe("статистика", () => {
  it("без ответов — нули и пустые дни", () => {
    const { db, userId, clock } = setup();
    const stats = userStats(db, userId, clock.now());
    expect(stats.words.total).toBe(0);
    expect(stats.streak).toBe(0);
    expect(stats.days).toHaveLength(STATS_DAYS);
    expect(stats.days.at(-1)).toEqual({
      day: "2026-10-17",
      total: 0,
      clean: 0,
    });
    expect(stats.days[0]?.day).toBe("2026-10-04");
    expect(stats.hardest).toEqual([]);
  });

  it("считает дни, серию, «сам вспомнил» и трудные слова", () => {
    const { db, userId, clock, add, review } = setup();
    const blood = add("кровь", "blood");
    const water = add("вода", "water");
    review(blood.id, 0, "type", Rating.Good);
    review(water.id, 0, "show", Rating.Again);
    review(water.id, 1, "choice", Rating.Again);
    review(blood.id, 2, "type", Rating.Easy);
    // Разрыв: 3 дня назад ничего, 4 дня назад был ответ — в серию не входит.
    review(water.id, 4, "hint", Rating.Again);

    const stats = userStats(db, userId, clock.now());
    expect(stats.words).toMatchObject({ total: 2, new: 2, reverse: 0 });
    expect(stats.today).toEqual({ day: "2026-10-17", total: 2, clean: 1 });
    expect(stats.streak).toBe(3);
    expect(stats.allTime).toEqual({ total: 5, clean: 2 });
    expect(stats.days.at(-2)).toEqual({
      day: "2026-10-16",
      total: 1,
      clean: 0,
    });
    expect(stats.hardest).toEqual([
      { wordId: water.id, prompt: "вода", answer: "water", misses: 3 },
    ]);
  });

  it("сегодня ещё не занимался — серия до вчера не обрывается", () => {
    const { db, userId, clock, add, review } = setup();
    const blood = add("кровь", "blood");
    review(blood.id, 1, "type", Rating.Good);
    review(blood.id, 2, "type", Rating.Good);
    expect(userStats(db, userId, clock.now()).streak).toBe(2);
  });

  it("GET /api/stats", async () => {
    const { app } = setup();
    const res = await app.request("/api/stats");
    expect(res.status).toBe(200);
    expect((await res.json()).days).toHaveLength(STATS_DAYS);
  });
});
