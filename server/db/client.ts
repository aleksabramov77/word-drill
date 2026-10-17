import Database from "better-sqlite3";
import {
  type BetterSQLite3Database,
  drizzle,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;

export const DEFAULT_DATABASE_PATH = "data/app.db";
export const DEFAULT_MIGRATIONS_PATH = "drizzle";

/** Открывает SQLite (":memory:" — для тестов) и применяет миграции. */
export function openDb(
  path = DEFAULT_DATABASE_PATH,
  migrationsFolder = DEFAULT_MIGRATIONS_PATH,
): Db {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return db;
}
