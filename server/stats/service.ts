import { eq } from "drizzle-orm";
import { Rating } from "../../src/shared/lib/srs/index.ts";
import type { Db } from "../db/client.ts";
import { reviews } from "../db/schema.ts";
import { listWords } from "../drill/service.ts";
import { localTime } from "../push/decide.ts";
import { getSettings } from "../push/service.ts";

/** Сколько дней в столбиках «по дням». */
export const STATS_DAYS = 14;
/** Сколько самых трудных слов показать. */
const HARDEST_LIMIT = 5;

export interface DayStats {
  /** Местная дата YYYY-MM-DD. */
  day: string;
  /** Сколько показов слов закончено. */
  total: number;
  /** Из них вспомнил сам — на первом шаге, без подсказок и вариантов. */
  clean: number;
}

export interface Stats {
  words: {
    total: number;
    new: number;
    learning: number;
    errors: number;
    learned: number;
    /** У скольких слов открыто обратное направление (en → ru). */
    reverse: number;
  };
  today: DayStats;
  /** Дней подряд с хотя бы одним ответом (сегодня ещё не занимался — считаем до вчера). */
  streak: number;
  /** Последние STATS_DAYS дней, старые сначала. */
  days: DayStats[];
  /** Всего показов и доля «вспомнил сам» за всё время. */
  allTime: { total: number; clean: number };
  /** Чаще всего «не вспомнил». */
  hardest: { wordId: number; prompt: string; answer: string; misses: number }[];
}

/** Дата YYYY-MM-DD на n дней раньше (календарно, без часовых поясов). */
function daysBefore(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

export function userStats(db: Db, userId: string, now: Date): Stats {
  const { timeZone } = getSettings(db, userId);
  const list = listWords(db, userId, now);
  const rows = db
    .select({
      wordId: reviews.wordId,
      at: reviews.at,
      deepest: reviews.deepest,
      grade: reviews.grade,
    })
    .from(reviews)
    .where(eq(reviews.userId, userId))
    .all();

  const byDay = new Map<string, DayStats>();
  const misses = new Map<number, number>();
  let clean = 0;
  for (const row of rows) {
    const day = localTime(row.at, timeZone).day;
    const stats = byDay.get(day) ?? { day, total: 0, clean: 0 };
    stats.total++;
    if (row.deepest === "type") {
      stats.clean++;
      clean++;
    }
    byDay.set(day, stats);
    if (row.grade === Rating.Again) {
      misses.set(row.wordId, (misses.get(row.wordId) ?? 0) + 1);
    }
  }

  const todayKey = localTime(now, timeZone).day;
  const dayStats = (day: string) =>
    byDay.get(day) ?? { day, total: 0, clean: 0 };
  const days = Array.from({ length: STATS_DAYS }, (_, i) =>
    dayStats(daysBefore(todayKey, STATS_DAYS - 1 - i)),
  );

  let streak = 0;
  let cursor = byDay.has(todayKey) ? todayKey : daysBefore(todayKey, 1);
  while (byDay.has(cursor)) {
    streak++;
    cursor = daysBefore(cursor, 1);
  }

  const byId = new Map(list.map((w) => [w.id, w]));
  const hardest = [...misses]
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, HARDEST_LIMIT)
    .map(([wordId, count]) => {
      const word = byId.get(wordId);
      return {
        wordId,
        prompt: word?.prompt ?? "",
        answer: word?.answers[0] ?? "",
        misses: count,
      };
    });

  const count = (status: string) =>
    list.filter((w) => w.status === status).length;
  return {
    words: {
      total: list.length,
      new: count("new"),
      learning: count("learning"),
      errors: count("errors"),
      learned: count("learned"),
      reverse: list.filter((w) => w.reverse).length,
    },
    today: dayStats(todayKey),
    streak,
    days,
    allTime: { total: rows.length, clean },
    hardest,
  };
}
