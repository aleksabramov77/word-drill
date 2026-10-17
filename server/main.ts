import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 5100);
const isProd = process.env.NODE_ENV === "production";

const root = new Hono();
root.route("/", createApp());
if (isProd) {
  // SPA: файлы из dist/client, всё остальное — index.html (маршруты решает клиент).
  root.use("/*", serveStatic({ root: "./dist/client" }));
  root.get("/*", serveStatic({ path: "./dist/client/index.html" }));
}

serve({ fetch: root.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`[word-drill] API: http://127.0.0.1:${info.port}`);
});
