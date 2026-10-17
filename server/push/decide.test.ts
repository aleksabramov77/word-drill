import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../users.ts";
import {
  decidePush,
  gapMinutes,
  localTime,
  type PushHistory,
} from "./decide.ts";

const settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/Moscow" };
const quiet: PushHistory = {
  lastSentAt: null,
  sentToday: 0,
  newToday: 0,
  unanswered: 0,
};
// 12:00 по Москве = 09:00 UTC.
const noon = new Date("2026-10-17T09:00:00Z");
const minutesBefore = (date: Date, m: number) =>
  new Date(date.getTime() - m * 60_000);

describe("localTime", () => {
  it("час и день по часовому поясу пользователя", () => {
    expect(localTime(noon, "Europe/Moscow")).toEqual({
      hour: 12,
      day: "2026-10-17",
    });
    expect(localTime(new Date("2026-10-17T22:30:00Z"), "Asia/Tokyo")).toEqual({
      hour: 7,
      day: "2026-10-18",
    });
  });
});

describe("decidePush", () => {
  it("днём, без истории — слать, можно новое слово", () => {
    expect(decidePush(settings, quiet, noon)).toEqual({
      send: true,
      allowNew: true,
    });
  });

  it("вне окна 9–22 — нет", () => {
    expect(
      decidePush(settings, quiet, new Date("2026-10-17T19:30:00Z")),
    ).toMatchObject({ send: false, reason: "outside-window" }); // 22:30 МСК
    expect(
      decidePush(settings, quiet, new Date("2026-10-17T05:59:00Z")),
    ).toMatchObject({ send: false, reason: "outside-window" }); // 08:59 МСК
    expect(
      decidePush(settings, quiet, new Date("2026-10-17T06:00:00Z")).send,
    ).toBe(true); // 09:00 МСК
  });

  it("пауза 20 минут после прошлого уведомления", () => {
    expect(
      decidePush(
        settings,
        { ...quiet, lastSentAt: minutesBefore(noon, 19) },
        noon,
      ),
    ).toMatchObject({ send: false, reason: "too-soon" });
    expect(
      decidePush(
        settings,
        { ...quiet, lastSentAt: minutesBefore(noon, 20) },
        noon,
      ).send,
    ).toBe(true);
  });

  it("без ответа пауза удваивается, но не больше 4 часов", () => {
    expect(gapMinutes(settings, 0)).toBe(20);
    expect(gapMinutes(settings, 1)).toBe(40);
    expect(gapMinutes(settings, 3)).toBe(160);
    expect(gapMinutes(settings, 10)).toBe(240);
    const twoUnanswered = {
      ...quiet,
      lastSentAt: minutesBefore(noon, 60),
      unanswered: 2,
    };
    expect(decidePush(settings, twoUnanswered, noon)).toMatchObject({
      send: false,
      reason: "too-soon",
    });
  });

  it("дневной лимит и лимит новых слов", () => {
    expect(
      decidePush(settings, { ...quiet, sentToday: 30 }, noon),
    ).toMatchObject({ send: false, reason: "daily-limit" });
    expect(decidePush(settings, { ...quiet, newToday: 5 }, noon)).toEqual({
      send: true,
      allowNew: false,
    });
  });
});
