import type { UserSettings } from "../users.ts";

// Когда слать уведомление — детерминированное правило без случайностей и нейросетей:
// окно часов по часовому поясу пользователя, пауза между пушами (удваивается, пока пуши остаются без ответа),
// дневной лимит. Какое слово — решает очередь тренировки (drillQueue), новые — не больше newPerDay в день.

export const MAX_GAP_MINUTES = 240;
const MINUTE = 60_000;

export interface PushHistory {
  lastSentAt: Date | null;
  /** Уведомлений за сегодняшний день (по часовому поясу пользователя). */
  sentToday: number;
  /** Новых слов, введённых уведомлениями за сегодня. */
  newToday: number;
  /** Сколько последних уведомлений подряд остались без ответа. */
  unanswered: number;
}

export type Decision =
  | { send: true; allowNew: boolean }
  | {
      send: false;
      reason: "outside-window" | "too-soon" | "daily-limit";
    };

/** Час (0–23) и календарный день (YYYY-MM-DD) в часовом поясе пользователя. */
export function localTime(
  now: Date,
  timeZone: string,
): { hour: number; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    hour: Number(get("hour")),
    day: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** Пауза после серии неотвеченных: 20 → 40 → 80 → … минут, не больше 4 часов. */
export function gapMinutes(settings: UserSettings, unanswered: number): number {
  return Math.min(
    MAX_GAP_MINUTES,
    settings.minGapMinutes * 2 ** Math.min(unanswered, 10),
  );
}

export function decidePush(
  settings: UserSettings,
  history: PushHistory,
  now: Date,
): Decision {
  const { hour } = localTime(now, settings.timeZone);
  if (hour < settings.windowStart || hour >= settings.windowEnd) {
    return { send: false, reason: "outside-window" };
  }
  if (history.sentToday >= settings.dailyPushLimit) {
    return { send: false, reason: "daily-limit" };
  }
  if (
    history.lastSentAt &&
    now.getTime() - history.lastSentAt.getTime() <
      gapMinutes(settings, history.unanswered) * MINUTE
  ) {
    return { send: false, reason: "too-soon" };
  }
  return { send: true, allowNew: history.newToday < settings.newPerDay };
}
