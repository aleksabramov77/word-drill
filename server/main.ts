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
import { pruneLogs, writeLog } from "./log.ts";
import { createWebPushSender, readVapidConfig } from "./push/sender.ts";
import { pushTick } from "./push/service.ts";
import { announceUpdate } from "./push/update.ts";
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
  // Готовая команда iOS (scripts/build-shortcut.ts): отдаётся файлом — по его имени «Команды» называют команду.
  // ?via=window — открыта в отдельном окне: отдаём inline, иначе — вложением. Каждое скачивание — в журнал:
  // по нему видно, кто запросил файл (Safari, окно внутри приложения, «Команды») и что получил.
  root.use("/word-drill.shortcut", async (c, next) => {
    await next();
    writeLog(
      db,
      {
        source: "server",
        event: "shortcut-download",
        data: {
          status: c.res.status,
          via: c.req.query("via") ?? null,
          dest: c.req.header("sec-fetch-dest") ?? null,
          mode: c.req.header("sec-fetch-mode") ?? null,
          site: c.req.header("sec-fetch-site") ?? null,
          accept: c.req.header("accept") ?? null,
          range: c.req.header("range") ?? null,
        },
        userAgent: c.req.header("user-agent"),
      },
      new Date(),
    );
  });
  root.get(
    "/word-drill.shortcut",
    serveStatic({
      path: "./dist/client/word-drill.shortcut",
      onFound: (_path, c) => {
        const disposition =
          c.req.query("via") === "window" ? "inline" : "attachment";
        c.header("Content-Type", "application/octet-stream");
        c.header(
          "Content-Disposition",
          `${disposition}; filename="Word Drill.shortcut"; filename*=UTF-8''Word%20Drill.shortcut`,
        );
      },
    }),
  );
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
    const now = new Date();
    pruneLogs(db, now);
    const updates = await announceUpdate(db, pusher, APP_VERSION, now);
    if (updates > 0) {
      console.log(
        `[word-drill] уведомлений об обновлении ${APP_VERSION}: ${updates}`,
      );
    }
    const { sent } = await pushTick(db, pusher, now);
    if (sent > 0) console.log(`[word-drill] уведомлений отправлено: ${sent}`);
  } catch (error) {
    console.error("[word-drill] ошибка планировщика уведомлений", error);
  } finally {
    ticking = false;
  }
}
if (pusher) setInterval(tick, PUSH_TICK_MS).unref();
