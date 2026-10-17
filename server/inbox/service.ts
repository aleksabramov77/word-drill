import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { normalize } from "../../src/shared/lib/answer-check/index.ts";
import type { Db } from "../db/client.ts";
import { inbox, words } from "../db/schema.ts";
import type { Dictionary } from "../dictionary/index.ts";
import { type Suggestion, suggestWords } from "./suggest.ts";

export const MAX_INBOX_TEXT = 5000;
const MAX_ITEMS = 50;

export const inboxInputSchema = z.object({
  text: z.string().trim().min(1).max(MAX_INBOX_TEXT),
});

export interface InboxItem {
  id: number;
  text: string;
  createdAt: string;
  suggestions: Suggestion[];
}

function knownAnswers(db: Db, userId: string): Set<string> {
  return new Set(
    db
      .select({ answers: words.answers })
      .from(words)
      .where(eq(words.userId, userId))
      .all()
      .flatMap((row) => row.answers.map(normalize)),
  );
}

export function addInboxItem(
  db: Db,
  dictionary: Dictionary,
  userId: string,
  text: string,
  now: Date,
): InboxItem {
  const row = db
    .insert(inbox)
    .values({ userId, text, createdAt: now })
    .returning()
    .get();
  return {
    id: row.id,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    suggestions: suggestWords(dictionary, text, knownAnswers(db, userId)),
  };
}

/** Входящие с подсказками; уже добавленные слова из подсказок убираются. */
export function listInbox(
  db: Db,
  dictionary: Dictionary,
  userId: string,
): InboxItem[] {
  const known = knownAnswers(db, userId);
  return db
    .select()
    .from(inbox)
    .where(eq(inbox.userId, userId))
    .orderBy(desc(inbox.createdAt), desc(inbox.id))
    .limit(MAX_ITEMS)
    .all()
    .map((row) => ({
      id: row.id,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      suggestions: suggestWords(dictionary, row.text, known),
    }));
}

export function deleteInboxItem(db: Db, userId: string, id: number): boolean {
  return (
    db
      .delete(inbox)
      .where(and(eq(inbox.userId, userId), eq(inbox.id, id)))
      .run().changes > 0
  );
}
