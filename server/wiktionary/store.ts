import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import Database from "better-sqlite3";
import { parseLine, searchKey } from "./format.ts";

export interface WiktHit {
  ru: string;
  en: string[];
  /** Что совпало, если не само слово: форма («крови») или английский перевод. */
  matched?: string;
}

export interface Wiktionary {
  /** Сколько русских слов в словаре (0 — словаря нет). */
  size: number;
  search(query: string, limit?: number): WiktHit[];
}

export const EMPTY_WIKTIONARY: Wiktionary = { size: 0, search: () => [] };

const CYRILLIC = /\p{Script=Cyrillic}/u;
/** Верхняя граница для поиска по началу слова: ключи между q и q + «￿». */
const PREFIX_END = "￿";

interface EntryRow {
  id: number;
  ru: string;
  en: string;
}

const SCHEMA = `
  drop table if exists entries;
  drop table if exists forms;
  drop table if exists english;
  create table entries (id integer primary key, ru text not null, ru_key text not null, en text not null);
  create table forms (key text not null, entry_id integer not null, form text not null);
  create table english (key text not null, entry_id integer not null, gloss text not null);
  create index entries_key on entries (ru_key);
  create index forms_key on forms (key);
  create index english_key on english (key);
  create table if not exists meta (name text primary key, value text not null);
`;

/** Заполняет базу словаря из строк TSV (одна транзакция). */
function fill(
  sqlite: Database.Database,
  lines: Iterable<string>,
  version: string,
) {
  sqlite.exec(SCHEMA);
  const entry = sqlite.prepare(
    "insert into entries (ru, ru_key, en) values (?, ?, ?)",
  );
  const form = sqlite.prepare(
    "insert into forms (key, entry_id, form) values (?, ?, ?)",
  );
  const english = sqlite.prepare(
    "insert into english (key, entry_id, gloss) values (?, ?, ?)",
  );
  sqlite.transaction(() => {
    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      const id = Number(
        entry.run(parsed.ru, searchKey(parsed.ru), JSON.stringify(parsed.en))
          .lastInsertRowid,
      );
      for (const f of parsed.forms) form.run(searchKey(f), id, f);
      for (const gloss of parsed.en) {
        const key = searchKey(gloss);
        english.run(key, id, gloss);
        // «to go» находится и по «go».
        if (key.startsWith("to ")) english.run(key.slice(3), id, gloss);
      }
    }
    sqlite
      .prepare(
        "insert or replace into meta (name, value) values ('version', ?)",
      )
      .run(version);
  })();
}

function storeOf(sqlite: Database.Database): Wiktionary {
  const count = sqlite.prepare("select count(*) as n from entries").get() as {
    n: number;
  };
  const exactRu = sqlite.prepare(
    "select id, ru, en from entries where ru_key = ?",
  );
  const byForm = sqlite.prepare(
    "select e.id, e.ru, e.en, f.form as matched from forms f join entries e on e.id = f.entry_id where f.key = ?",
  );
  const prefixRu = sqlite.prepare(
    "select id, ru, en from entries where ru_key >= ? and ru_key < ? order by length(ru_key), ru_key limit ?",
  );
  const exactEn = sqlite.prepare(
    "select e.id, e.ru, e.en, g.gloss as matched from english g join entries e on e.id = g.entry_id where g.key = ? order by e.id",
  );
  const prefixEn = sqlite.prepare(
    "select e.id, e.ru, e.en, g.gloss as matched from english g join entries e on e.id = g.entry_id where g.key >= ? and g.key < ? order by length(g.key), e.id limit ?",
  );

  return {
    size: count.n,
    search(query, limit = 10) {
      const q = searchKey(query);
      if (q === "") return [];
      const rows: (EntryRow & { matched?: string })[] = CYRILLIC.test(q)
        ? [
            ...(exactRu.all(q) as EntryRow[]),
            ...(byForm.all(q) as (EntryRow & { matched: string })[]),
            ...(prefixRu.all(q, q + PREFIX_END, limit * 2) as EntryRow[]),
          ]
        : [
            ...(exactEn.all(q) as (EntryRow & { matched: string })[]),
            ...(prefixEn.all(q, q + PREFIX_END, limit * 3) as (EntryRow & {
              matched: string;
            })[]),
          ];
      const seen = new Set<number>();
      const hits: WiktHit[] = [];
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        hits.push({
          ru: row.ru,
          en: JSON.parse(row.en) as string[],
          ...(row.matched && row.matched !== row.ru
            ? { matched: row.matched }
            : {}),
        });
        if (hits.length === limit) break;
      }
      return hits;
    },
  };
}

/** Словарь из строк — для тестов (база в памяти). */
export function wiktionaryFromLines(lines: Iterable<string>): Wiktionary {
  const sqlite = new Database(":memory:");
  fill(sqlite, lines, "test");
  return storeOf(sqlite);
}

/**
 * Открывает словарь: data/wiktionary.tsv.gz переносится в отдельную SQLite-базу один раз
 * (и заново — когда файл обновили). В памяти словарь не держим: ищем по индексам базы.
 */
export function openWiktionary(sourcePath: string, dbPath: string): Wiktionary {
  if (!existsSync(sourcePath)) {
    console.warn(
      `[word-drill] нет словаря ${sourcePath} — запустите pnpm wikt:import`,
    );
    return EMPTY_WIKTIONARY;
  }
  const raw = readFileSync(sourcePath);
  const version = createHash("sha1").update(raw).digest("hex");
  const sqlite = new Database(dbPath);
  sqlite.exec(
    "create table if not exists meta (name text primary key, value text not null)",
  );
  const current = sqlite
    .prepare("select value from meta where name = 'version'")
    .get() as { value: string } | undefined;
  if (current?.value !== version) {
    const started = Date.now();
    fill(sqlite, gunzipSync(raw).toString("utf8").split("\n"), version);
    console.log(
      `[word-drill] Викисловарь перенесён в ${dbPath} за ${Date.now() - started} мс`,
    );
  }
  return storeOf(sqlite);
}
