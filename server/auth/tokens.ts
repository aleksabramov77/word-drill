import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.ts";
import { apiTokens } from "../db/schema.ts";

const TOKEN_PREFIX = "wd_";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Новый токен; показывается один раз — в базе остаётся только хэш. */
/** Новый ключ заменяет прежние: у пользователя один ключ — для одной команды «скриншот → Word Drill». */
export function createApiToken(db: Db, userId: string, now: Date): string {
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
  db.transaction((tx) => {
    tx.delete(apiTokens).where(eq(apiTokens.userId, userId)).run();
    tx.insert(apiTokens)
      .values({
        userId,
        hash: hash(token),
        prefix: token.slice(0, TOKEN_PREFIX.length + 4),
        createdAt: now,
      })
      .run();
  });
  return token;
}

export function apiTokenUser(db: Db, token: string, now: Date): string | null {
  const row = db
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(eq(apiTokens.hash, hash(token)))
    .get();
  if (!row) return null;
  db.update(apiTokens)
    .set({ lastUsedAt: now })
    .where(eq(apiTokens.id, row.id))
    .run();
  return row.userId;
}

export function listApiTokens(db: Db, userId: string) {
  return db
    .select({
      id: apiTokens.id,
      prefix: apiTokens.prefix,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt))
    .all();
}

export function deleteApiToken(db: Db, userId: string, id: number): boolean {
  return (
    db
      .delete(apiTokens)
      .where(and(eq(apiTokens.userId, userId), eq(apiTokens.id, id)))
      .run().changes > 0
  );
}
