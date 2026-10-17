import { Hono } from "hono";
import { z } from "zod";
import { mountAdmin } from "./admin/routes.ts";
import type { AuthConfig } from "./auth/config.ts";
import type { IdentityProvider } from "./auth/google.ts";
import { type AuthEnv, mountAuth } from "./auth/routes.ts";
import {
  createApiToken,
  deleteApiToken,
  listApiTokens,
} from "./auth/tokens.ts";
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
import {
  addInboxItem,
  deleteInboxItem,
  inboxInputSchema,
  listInbox,
} from "./inbox/service.ts";
import { clientLogSchema, writeLog } from "./log.ts";
import type { PushSender } from "./push/sender.ts";
import {
  deleteSubscription,
  getSettings,
  markPushesAnswered,
  notifyEmails,
  saveSubscription,
  sendTestPush,
  settingsSchema,
  subscriptionCount,
  subscriptionSchema,
  updateSettings,
} from "./push/service.ts";
import { rememberAppVersion } from "./push/update.ts";
import { APP_VERSION } from "./version.ts";

export interface AppDeps {
  db: Db;
  dictionary: Dictionary;
  /** По умолчанию — dev: все запросы от локального пользователя. */
  auth?: AuthConfig;
  identity?: IdentityProvider;
  /** Нет VAPID-ключей — уведомления выключены. */
  pusher?: PushSender;
  now?: () => Date;
}

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
export function createApp({
  db,
  dictionary,
  auth = { mode: "dev", email: "local@localhost" },
  identity,
  pusher,
  now = () => new Date(),
}: AppDeps) {
  const app = new Hono<AuthEnv>().basePath("/api");
  const admins = auth.mode === "google" ? [...auth.allowedEmails] : [];
  mountAuth(app, {
    db,
    auth,
    identity,
    now,
    onAccessRequest: pusher
      ? async (person) => {
          await notifyEmails(db, pusher, admins, {
            title: "Заявка на вход в Word Drill",
            body: person.name
              ? `${person.name} · ${person.email}`
              : person.email,
            url: "/admin",
            tag: "access",
          });
        }
      : undefined,
  });
  // Версия приложения пользователя — чтобы не звать обновляться тех, у кого уже новая (push/update.ts).
  app.use("*", async (c, next) => {
    const userId = c.get("userId");
    if (userId) rememberAppVersion(db, userId, c.req.header("x-app-version"));
    await next();
  });
  mountAdmin(app, { db, auth, now });

  app.get("/health", (c) => c.json({ ok: true, version: APP_VERSION }));

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

  app.get("/drill/next", (c) => {
    const word = idSchema.safeParse(c.req.query("word"));
    return c.json(
      drillQueue(db, c.get("userId"), now(), {
        prefer: word.success ? word.data : undefined,
        dictionary,
      }),
    );
  });

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
    if (result) markPushesAnswered(db, c.get("userId"), now());
    return result ? c.json(result) : c.json({ error: "not found" }, 404);
  });

  app.get("/settings", (c) =>
    c.json({ settings: getSettings(db, c.get("userId")) }),
  );

  app.patch("/settings", async (c) => {
    const parsed = settingsSchema.safeParse(await body(c.req));
    if (!parsed.success) return c.json({ error: "bad settings" }, 400);
    const settings = updateSettings(db, c.get("userId"), parsed.data);
    if (settings === "bad-window") return c.json({ error: "bad window" }, 400);
    return c.json({ settings });
  });

  app.get("/push/config", (c) =>
    c.json({
      enabled: Boolean(pusher),
      publicKey: pusher?.publicKey ?? null,
      subscriptions: subscriptionCount(db, c.get("userId")),
    }),
  );

  app.post("/push/subscribe", async (c) => {
    if (!pusher) return c.json({ error: "push disabled" }, 503);
    const parsed = subscriptionSchema.safeParse(await body(c.req));
    if (!parsed.success) return c.json({ error: "bad subscription" }, 400);
    saveSubscription(
      db,
      c.get("userId"),
      parsed.data,
      c.req.header("user-agent") ?? "",
      now(),
    );
    return c.json({ ok: true }, 201);
  });

  app.post("/push/unsubscribe", async (c) => {
    const parsed = z
      .object({ endpoint: z.string().max(1000) })
      .safeParse(await body(c.req));
    if (!parsed.success) return c.json({ error: "bad endpoint" }, 400);
    deleteSubscription(db, c.get("userId"), parsed.data.endpoint);
    return c.body(null, 204);
  });

  app.post("/push/test", async (c) => {
    if (!pusher) return c.json({ error: "push disabled" }, 503);
    return c.json({
      delivered: await sendTestPush(db, pusher, c.get("userId")),
    });
  });

  app.get("/tokens", (c) =>
    c.json({ tokens: listApiTokens(db, c.get("userId")) }),
  );

  app.post("/tokens", (c) =>
    c.json({ token: createApiToken(db, c.get("userId"), now()) }, 201),
  );

  app.delete("/tokens/:id", (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "bad id" }, 400);
    return deleteApiToken(db, c.get("userId"), id.data)
      ? c.body(null, 204)
      : c.json({ error: "not found" }, 404);
  });

  // Журнал событий приложения (server/log.ts): для разбора проблем, видных только на устройстве.
  app.post("/log", async (c) => {
    const parsed = clientLogSchema.safeParse(await body(c.req));
    if (!parsed.success) return c.json({ error: "bad log entry" }, 400);
    writeLog(
      db,
      {
        userId: c.get("userId"),
        source: "client",
        event: parsed.data.event,
        data: parsed.data.data,
        appVersion: c.req.header("x-app-version"),
        userAgent: c.req.header("user-agent"),
      },
      now(),
    );
    return c.body(null, 204);
  });

  app.get("/inbox", (c) =>
    c.json({ items: listInbox(db, dictionary, c.get("userId")) }),
  );

  // Текст — JSON {"text": "..."} или просто тело text/plain («Команды» iOS шлют и так, и так).
  app.post("/inbox", async (c) => {
    const isJson = c.req.header("content-type")?.includes("application/json");
    const raw = isJson ? await body(c.req) : { text: await c.req.text() };
    const parsed = inboxInputSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: "bad text" }, 400);
    const item = addInboxItem(
      db,
      dictionary,
      c.get("userId"),
      parsed.data.text,
      now(),
    );
    return c.json({ item }, 201);
  });

  app.delete("/inbox/:id", (c) => {
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "bad id" }, 400);
    return deleteInboxItem(db, c.get("userId"), id.data)
      ? c.body(null, 204)
      : c.json({ error: "not found" }, 404);
  });

  return app;
}
