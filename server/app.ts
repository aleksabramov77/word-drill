import { Hono } from "hono";

// API приложения. Статику клиента в проде подключает server/main.ts, чтобы app можно было тестировать без файлов.
export function createApp() {
  const app = new Hono().basePath("/api");
  app.get("/health", (c) => c.json({ ok: true }));
  return app;
}
