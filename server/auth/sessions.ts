import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { sessions } from "../db/schema.ts";

export const SESSION_COOKIE = "wd_session";
export const SESSION_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

/** В базе — только хэш токена: утечка файла БД не даёт войти. */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(db: Db, userId: string, now: Date): string {
  const token = randomBytes(32).toString("base64url");
  db.insert(sessions)
    .values({
      id: hash(token),
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY),
    })
    .run();
  return token;
}

export function sessionUser(db: Db, token: string, now: Date): string | null {
  const row = db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.id, hash(token)), gt(sessions.expiresAt, now)))
    .get();
  return row?.userId ?? null;
}

export function deleteSession(db: Db, token: string): void {
  db.delete(sessions)
    .where(eq(sessions.id, hash(token)))
    .run();
}
