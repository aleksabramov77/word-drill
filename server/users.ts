import { eq } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { users } from "./db/schema.ts";

export interface UserSettings {
  /** Окно уведомлений: с какого и до какого часа (по часовому поясу пользователя). */
  windowStart: number;
  windowEnd: number;
  /** Не чаще одного уведомления за столько минут. */
  minGapMinutes: number;
  /** Не больше уведомлений в день. */
  dailyPushLimit: number;
  /** Не больше новых слов в день через уведомления. */
  newPerDay: number;
  timeZone: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  windowStart: 9,
  windowEnd: 22,
  minGapMinutes: 20,
  dailyPushLimit: 30,
  newPerDay: 5,
  timeZone: "UTC",
};

/** Пользователь до подключения входа (этап 4): один на всё приложение. */
export const LOCAL_USER_ID = "local";

export function ensureUser(db: Db, id: string, email: string, now: Date): void {
  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .get();
  if (existing) return;
  db.insert(users)
    .values({
      id,
      email,
      settings: DEFAULT_SETTINGS,
      speedHistory: [],
      createdAt: now,
    })
    .run();
}
