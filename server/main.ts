import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApp } from "./app.ts";
import { readAuthConfig } from "./auth/config.ts";
import { createGoogleProvider } from "./auth/google.ts";
import {
  DEFAULT_DATABASE_PATH,
  DEFAULT_MIGRATIONS_PATH,
  openDb,
} from "./db/client.ts";
import { DEFAULT_DICTIONARY_PATH, loadDictionary } from "./dictionary/index.ts";
import { createWebPushSender, readVapidConfig } from "./push/sender.ts";
import { pushTick } from "./push/service.ts";
import { APP_VERSION } from "./version.ts";

const port = Number(process.env.PORT ?? 5100);
const isProd = process.env.NODE_ENV === "production";
const databasePath = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
const auth = readAuthConfig(process.env);

mkdirSync(dirname(databasePath), { recursive: true });
const db = openDb(
  databasePath,
  process.env.MIGRATIONS_PATH ?? DEFAULT_MIGRATIONS_PATH,
);
const dictionary = loadDictionary(
  process.env.DICTIONARY_PATH ?? DEFAULT_DICTIONARY_PATH,
);

const vapid = readVapidConfig(process.env);
const pusher = vapid ? createWebPushSender(vapid) : undefined;

const root = new Hono();
root.route(
  "/",
  createApp({
    db,
    dictionary,
    auth,
    identity: auth.mode === "google" ? createGoogleProvider(auth) : undefined,
    pusher,
  }),
);
if (isProd) {
  // SPA: файлы из dist/client, всё остальное — index.html (маршруты решает клиент).
  root.use("/*", serveStatic({ root: "./dist/client" }));
  root.get("/*", serveStatic({ path: "./dist/client/index.html" }));
}

serve({ fetch: root.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(
    `[word-drill] ${APP_VERSION} API: http://127.0.0.1:${info.port}, вход: ${auth.mode}, уведомления: ${pusher ? "вкл" : "выкл (нет VAPID)"}, словарь: ${dictionary.words.length} слов, БД: ${databasePath}`,
  );
});

// Планировщик уведомлений: раз в минуту решает, кому пора прислать слово (server/push/decide.ts).
const PUSH_TICK_MS = 60_000;
let ticking = false;
async function tick() {
  if (!pusher || ticking) return;
  ticking = true;
  try {
    const { sent } = await pushTick(db, pusher, new Date());
    if (sent > 0) console.log(`[word-drill] уведомлений отправлено: ${sent}`);
  } catch (error) {
    console.error("[word-drill] ошибка планировщика уведомлений", error);
  } finally {
    ticking = false;
  }
}
if (pusher) setInterval(tick, PUSH_TICK_MS).unref();
