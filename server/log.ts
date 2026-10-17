import { lt } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./db/client.ts";
import { clientLogs } from "./db/schema.ts";

// Журнал событий для разбора проблем, которые видны только на устройстве (iPhone, Android):
// приложение присылает события (POST /api/log), сервер дописывает свои (например, скачивание
// файла команды). Смотреть: sqlite3 /var/lib/words/app.db "select * from client_logs order by id desc".

const KEEP_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;
const MAX_DATA_CHARS = 4000;
const MAX_UA_CHARS = 400;

export const clientLogSchema = z.object({
  event: z.string().trim().min(1).max(80),
  data: z.record(z.string(), z.unknown()).optional(),
});

export interface LogEntry {
  userId?: string | null;
  source: "client" | "server";
  event: string;
  data?: Record<string, unknown>;
  appVersion?: string | null;
  userAgent?: string | null;
}

/** Обрезать слишком большие данные: журнал — для разбора, а не для хранения всего подряд. */
function limited(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!data) return null;
  const json = JSON.stringify(data);
  return json.length <= MAX_DATA_CHARS
    ? data
    : { truncated: json.slice(0, MAX_DATA_CHARS) };
}

export function writeLog(db: Db, entry: LogEntry, now: Date): void {
  db.insert(clientLogs)
    .values({
      userId: entry.userId ?? null,
      at: now,
      source: entry.source,
      event: entry.event,
      data: limited(entry.data),
      appVersion: entry.appVersion ?? null,
      userAgent: entry.userAgent?.slice(0, MAX_UA_CHARS) ?? null,
    })
    .run();
}

/** Удалить записи старше 14 дней. */
export function pruneLogs(db: Db, now: Date): number {
  return db
    .delete(clientLogs)
    .where(lt(clientLogs.at, new Date(now.getTime() - KEEP_DAYS * DAY)))
    .run().changes;
}
