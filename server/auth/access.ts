import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import { access, sessions, users } from "../db/schema.ts";

// Кто может входить через Google:
// - почты из ALLOWED_EMAILS — админы: всегда входят и решают заявки (страница «Админка»);
// - остальные — по таблице access: незнакомая почта при входе становится заявкой (pending),
//   админ одобряет (approved) или отклоняет (denied). Можно и заранее одобрить почту.

export type AccessStatus = "approved" | "pending" | "denied";

export interface AccessRow {
  email: string;
  name: string;
  status: AccessStatus;
  requestedAt: string | null;
  decidedAt: string | null;
}

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export function accessOf(db: Db, email: string): AccessStatus | null {
  return (
    db
      .select({ status: access.status })
      .from(access)
      .where(eq(access.email, email))
      .get()?.status ?? null
  );
}

/** Заявка на вход; true — новая (админов надо уведомить), false — уже была. */
export function requestAccess(
  db: Db,
  email: string,
  name: string,
  now: Date,
): boolean {
  const existing = accessOf(db, email);
  if (existing) return false;
  db.insert(access)
    .values({ email, name, status: "pending", requestedAt: now })
    .run();
  return true;
}

export function listAccess(db: Db): AccessRow[] {
  return db
    .select()
    .from(access)
    .orderBy(asc(access.status), asc(access.email))
    .all()
    .map((row) => ({
      email: row.email,
      name: row.name,
      status: row.status,
      requestedAt: row.requestedAt?.toISOString() ?? null,
      decidedAt: row.decidedAt?.toISOString() ?? null,
    }));
}

/** Решение админа. Отказ сразу закрывает уже открытые сессии этой почты. */
export function decideAccess(
  db: Db,
  email: string,
  status: "approved" | "denied",
  now: Date,
): void {
  db.insert(access)
    .values({ email, status, decidedAt: now })
    .onConflictDoUpdate({
      target: access.email,
      set: { status, decidedAt: now },
    })
    .run();
  if (status === "denied") closeSessions(db, email);
}

export function removeAccess(db: Db, email: string): void {
  db.delete(access).where(eq(access.email, email)).run();
  closeSessions(db, email);
}

function closeSessions(db: Db, email: string): void {
  const ids = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .all()
    .map((row) => row.id);
  if (ids.length)
    db.delete(sessions).where(inArray(sessions.userId, ids)).run();
}
