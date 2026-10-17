import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApp } from "./app.ts";
import {
  DEFAULT_DATABASE_PATH,
  DEFAULT_MIGRATIONS_PATH,
  openDb,
} from "./db/client.ts";
import { DEFAULT_DICTIONARY_PATH, loadDictionary } from "./dictionary/index.ts";
import { ensureUser, LOCAL_USER_ID } from "./users.ts";

const port = Number(process.env.PORT ?? 5100);
const isProd = process.env.NODE_ENV === "production";
const databasePath = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;

mkdirSync(dirname(databasePath), { recursive: true });
const db = openDb(
  databasePath,
  process.env.MIGRATIONS_PATH ?? DEFAULT_MIGRATIONS_PATH,
);
ensureUser(db, LOCAL_USER_ID, "local@localhost", new Date());
const dictionary = loadDictionary(
  process.env.DICTIONARY_PATH ?? DEFAULT_DICTIONARY_PATH,
);

const root = new Hono();
root.route("/", createApp({ db, dictionary }));
if (isProd) {
  // SPA: файлы из dist/client, всё остальное — index.html (маршруты решает клиент).
  root.use("/*", serveStatic({ root: "./dist/client" }));
  root.get("/*", serveStatic({ path: "./dist/client/index.html" }));
}

serve({ fetch: root.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(
    `[word-drill] API: http://127.0.0.1:${info.port}, словарь: ${dictionary.words.length} слов, БД: ${databasePath}`,
  );
});
