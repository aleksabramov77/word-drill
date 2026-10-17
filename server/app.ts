import { Hono } from "hono";
import { z } from "zod";
import {
  type Dictionary,
  searchDictionary,
  unitWords,
} from "./dictionary/index.ts";

export interface AppDeps {
  dictionary: Dictionary;
}

const searchQuerySchema = z.object({
  q: z.string().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// API приложения. Статику клиента в проде подключает server/main.ts, чтобы app можно было тестировать без файлов.
export function createApp({ dictionary }: AppDeps) {
  const app = new Hono().basePath("/api");
  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/dictionary/search", (c) => {
    const parsed = searchQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: "bad query" }, 400);
    const { q, limit } = parsed.data;
    return c.json({ hits: searchDictionary(dictionary, q, limit) });
  });

  app.get("/dictionary/units", (c) => c.json({ units: dictionary.units }));

  app.get("/dictionary/units/:n", (c) => {
    const n = Number(c.req.param("n"));
    const unit = dictionary.units.find((u) => u.n === n);
    if (!unit) return c.json({ error: "unit not found" }, 404);
    return c.json({ unit, words: unitWords(dictionary, n) });
  });

  return app;
}
