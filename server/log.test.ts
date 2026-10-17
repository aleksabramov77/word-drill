import { describe, expect, it } from "vitest";
import { clientLogs } from "./db/schema.ts";
import { pruneLogs, writeLog } from "./log.ts";
import { createTestApp } from "./testing.ts";

const DAY = 24 * 60 * 60 * 1000;

describe("журнал событий", () => {
  it("приложение пишет событие с версией, браузером и пользователем", async () => {
    const { app, db, userId } = createTestApp();
    const res = await app.request("/api/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Version": "1.3.2",
        "User-Agent": "iPhone Safari",
      },
      body: JSON.stringify({ event: "shortcut-open", data: { via: "same" } }),
    });
    expect(res.status).toBe(204);
    expect(db.select().from(clientLogs).all()).toEqual([
      expect.objectContaining({
        userId,
        source: "client",
        event: "shortcut-open",
        data: { via: "same" },
        appVersion: "1.3.2",
        userAgent: "iPhone Safari",
      }),
    ]);
  });

  it("без названия события — 400; большие данные обрезаются", async () => {
    const { app, db, clock } = createTestApp();
    const bad = await app.request("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: " " }),
    });
    expect(bad.status).toBe(400);
    writeLog(
      db,
      { source: "server", event: "big", data: { text: "x".repeat(10_000) } },
      clock.now(),
    );
    const [row] = db.select().from(clientLogs).all();
    expect(JSON.stringify(row?.data).length).toBeLessThan(4100);
  });

  it("записи старше 14 дней удаляются", () => {
    const { db, clock } = createTestApp();
    const now = clock.now();
    writeLog(
      db,
      { source: "server", event: "old" },
      new Date(now.getTime() - 15 * DAY),
    );
    writeLog(
      db,
      { source: "server", event: "fresh" },
      new Date(now.getTime() - DAY),
    );
    expect(pruneLogs(db, now)).toBe(1);
    expect(
      db
        .select()
        .from(clientLogs)
        .all()
        .map((r) => r.event),
    ).toEqual(["fresh"]);
  });
});
