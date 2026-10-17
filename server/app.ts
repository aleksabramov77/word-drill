import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "./db/client.ts";
import {
  type Dictionary,
  searchDictionary,
  unitWords,
} from "./dictionary/index.ts";
import {
  addWord,
  addWordSchema,
  answerStep,
  deleteWord,
  drillQueue,
  listWords,
  updateWord,
  updateWordSchema,
} from "./drill/service.ts";
import { LOCAL_USER_ID } from "./users.ts";

export interface AppDeps {
  db: Db;
  dictionary: Dictionary;
  now?: () => Date;
}

type Env = { Variables: { userId: string } };

const searchQuerySchema = z.object({
  q: z.string().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const idSchema = z.coerce.number().int().positive();

const stepSchema = z.object({
  stage: z.enum(["type", "hint", "choice", "show"]),
  input: z.string().max(200),
  elapsedMs: z.number().int().min(0).max(3_600_000).optional(),
  action: z.enum(["reveal", "choices"]).optional(),
});

async function body(req: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// API приложения. Статику клиента в проде подключает server/main.ts, чтобы app можно было тестировать без файлов.
export function createApp({ db, dictionary, now = () => new Date() }: AppDeps) {
  const app = new Hono<Env>().basePath("/api");

  // До подключения входа (этап 4) все запросы — от одного локального пользователя.
  app.use("*", async (c, next) => {
    c.set("userId", LOCAL_USER_ID);
    await next();
  });

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

  app.get("/words", (c) =>
    c.json({ words: listWords(db, c.get("userId"), now()) }),
  );

  app.post("/words", async (c) => {
    const parsed = addWordSchema.safeParse(await body(c.req));
    if (!parsed.success) return c.json({ error: "bad word" }, 400);
    const result = addWord(db, c.get("userId"), parsed.data, now());
    if (result === "duplicate") return c.json({ error: "duplicate" }, 409);
    return c.json({ word: result }, 201);
  });

  app.patch("/words/:id", async (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    const parsed = updateWordSchema.safeParse(await body(c.req));
    if (!id.success || !parsed.success)
      return c.json({ error: "bad word" }, 400);
    const result = updateWord(db, c.get("userId"), id.data, parsed.data, now());
    if (result === null) return c.json({ error: "not found" }, 404);
    if (result === "duplicate") return c.json({ error: "duplicate" }, 409);
    return c.json({ word: result });
  });

  app.delete("/words/:id", (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "bad id" }, 400);
    return deleteWord(db, c.get("userId"), id.data)
      ? c.body(null, 204)
      : c.json({ error: "not found" }, 404);
  });

  app.get("/drill/next", (c) => c.json(drillQueue(db, c.get("userId"), now())));

  app.post("/drill/:wordId/step", async (c) => {
    const id = idSchema.safeParse(c.req.param("wordId"));
    const parsed = stepSchema.safeParse(await body(c.req));
    if (!id.success || !parsed.success)
      return c.json({ error: "bad step" }, 400);
    const result = answerStep(
      db,
      dictionary,
      c.get("userId"),
      id.data,
      parsed.data,
      now(),
    );
    return result ? c.json(result) : c.json({ error: "not found" }, 404);
  });

  return app;
}
