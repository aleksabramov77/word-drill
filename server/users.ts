import { eq } from "drizzle-orm";
import type { Identity } from "./auth/google.ts";
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

/** Пользователь режима dev (без Google): один на всё приложение. */
export const LOCAL_USER_ID = "local";

export function findUser(db: Db, id: string) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/** Создаёт пользователя, если его нет; возвращает id. */
export function ensureUser(
  db: Db,
  id: string,
  email: string,
  now: Date,
  name = "",
): string {
  if (findUser(db, id)) return id;
  db.insert(users)
    .values({
      id,
      email,
      name,
      settings: DEFAULT_SETTINGS,
      speedHistory: [],
      createdAt: now,
    })
    .run();
  return id;
}

/** Пользователь Google: id из постоянного sub, почта и имя обновляются при каждом входе. */
export function ensureGoogleUser(db: Db, person: Identity, now: Date): string {
  const id = `google:${person.sub}`;
  ensureUser(db, id, person.email, now, person.name);
  db.update(users)
    .set({ email: person.email, name: person.name })
    .where(eq(users.id, id))
    .run();
  return id;
}
