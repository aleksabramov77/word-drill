import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { pushLog, pushSubscriptions, users } from "../db/schema.ts";
import { drillQueue } from "../drill/service.ts";
import { DEFAULT_SETTINGS, type UserSettings } from "../users.ts";
import { decidePush, localTime, type PushHistory } from "./decide.ts";
import type { PushPayload, PushSender } from "./sender.ts";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
/** Только что добавленное слово ещё перед глазами — в уведомления оно попадает не раньше, чем через час. */
export const NEW_WORD_DELAY_MINUTES = 60;

export const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.url().max(1000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }),
  timeZone: z.string().max(64).optional(),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const settingsSchema = z
  .object({
    windowStart: z.number().int().min(0).max(23),
    windowEnd: z.number().int().min(1).max(24),
    minGapMinutes: z.number().int().min(5).max(720),
    dailyPushLimit: z.number().int().min(1).max(100),
    newPerDay: z.number().int().min(0).max(50),
    timeZone: z.string().refine(isValidTimeZone, "неизвестный часовой пояс"),
  })
  .partial();

export function getSettings(db: Db, userId: string): UserSettings {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  return { ...DEFAULT_SETTINGS, ...user?.settings };
}

export function updateSettings(
  db: Db,
  userId: string,
  patch: z.infer<typeof settingsSchema>,
): UserSettings | "bad-window" {
  const settings = { ...getSettings(db, userId), ...patch };
  if (settings.windowEnd <= settings.windowStart) return "bad-window";
  db.update(users).set({ settings }).where(eq(users.id, userId)).run();
  return settings;
}

export function saveSubscription(
  db: Db,
  userId: string,
  input: SubscriptionInput,
  userAgent: string,
  now: Date,
): void {
  const { endpoint, keys } = input.subscription;
  db.insert(pushSubscriptions)
    .values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent.slice(0, 300),
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth },
    })
    .run();
  if (input.timeZone && isValidTimeZone(input.timeZone)) {
    updateSettings(db, userId, { timeZone: input.timeZone });
  }
}

export function deleteSubscription(
  db: Db,
  userId: string,
  endpoint: string,
): void {
  db.delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    )
    .run();
}

export function subscriptionCount(db: Db, userId: string): number {
  return db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all().length;
}

/** Пользователь что-то ответил — все его уведомления считаются отвеченными. */
export function markPushesAnswered(db: Db, userId: string, now: Date): void {
  db.update(pushLog)
    .set({ answeredAt: now })
    .where(and(eq(pushLog.userId, userId), isNull(pushLog.answeredAt)))
    .run();
}

export function pushHistory(
  db: Db,
  userId: string,
  settings: UserSettings,
  now: Date,
): PushHistory {
  const recent = db
    .select()
    .from(pushLog)
    .where(
      and(
        eq(pushLog.userId, userId),
        gt(pushLog.sentAt, new Date(now.getTime() - 2 * DAY)),
      ),
    )
    .orderBy(desc(pushLog.sentAt))
    .all();
  const today = localTime(now, settings.timeZone).day;
  const sentToday = recent.filter(
    (row) => localTime(row.sentAt, settings.timeZone).day === today,
  );
  const firstAnswered = recent.findIndex((row) => row.answeredAt !== null);
  return {
    lastSentAt: recent[0]?.sentAt ?? null,
    sentToday: sentToday.length,
    newToday: sentToday.filter((row) => row.isNew).length,
    unanswered: firstAnswered === -1 ? recent.length : firstAnswered,
  };
}

export async function deliver(
  db: Db,
  sender: PushSender,
  userId: string,
  payload: PushPayload,
): Promise<number> {
  const targets = db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all();
  let delivered = 0;
  for (const target of targets) {
    const result = await sender.send(target, payload);
    if (result.ok) delivered++;
    else if (result.gone) {
      db.delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, target.id))
        .run();
    }
  }
  return delivered;
}

/** Уведомление пользователям с этими почтами (например, админам — о заявке на вход). */
export async function notifyEmails(
  db: Db,
  sender: PushSender,
  emails: readonly string[],
  payload: PushPayload,
): Promise<number> {
  if (emails.length === 0) return 0;
  const targets = db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, [...emails]))
    .all();
  let delivered = 0;
  for (const { id } of targets)
    delivered += await deliver(db, sender, id, payload);
  return delivered;
}

export function wordPayload(wordId: number, prompt: string): PushPayload {
  return {
    title: "Как по-английски?",
    body: prompt,
    url: `/?word=${wordId}`,
    tag: "word",
  };
}

/** Один проход планировщика: каждому, кому пора, — одно уведомление со словом. */
export async function pushTick(
  db: Db,
  sender: PushSender,
  now: Date,
): Promise<{ sent: number }> {
  const userIds = [
    ...new Set(
      db
        .select({ userId: pushSubscriptions.userId })
        .from(pushSubscriptions)
        .all()
        .map((row) => row.userId),
    ),
  ];
  let sent = 0;
  for (const userId of userIds) {
    const settings = getSettings(db, userId);
    const decision = decidePush(
      settings,
      pushHistory(db, userId, settings, now),
      now,
    );
    if (!decision.send) continue;
    const { card } = drillQueue(db, userId, now, {
      includeNew: decision.allowNew,
      newAddedBefore: new Date(now.getTime() - NEW_WORD_DELAY_MINUTES * MINUTE),
    });
    if (!card) continue;
    const delivered = await deliver(
      db,
      sender,
      userId,
      wordPayload(card.wordId, card.prompt),
    );
    if (delivered === 0) continue;
    db.insert(pushLog)
      .values({ userId, wordId: card.wordId, isNew: card.isNew, sentAt: now })
      .run();
    sent++;
  }
  return { sent };
}

export async function sendTestPush(
  db: Db,
  sender: PushSender,
  userId: string,
): Promise<number> {
  return deliver(db, sender, userId, {
    title: "Word Drill",
    body: "Уведомления работают 👍",
    url: "/more/notifications",
    tag: "test",
  });
}
