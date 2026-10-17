import { desc, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import {
  decideAccess,
  emailSchema,
  listAccess,
  removeAccess,
} from "../auth/access.ts";
import type { AuthConfig } from "../auth/config.ts";
import { type AuthEnv, isAdminEmail } from "../auth/routes.ts";
import type { Db } from "../db/client.ts";
import { users, words } from "../db/schema.ts";
import { findUser } from "../users.ts";

const decisionSchema = z.object({
  email: emailSchema,
  status: z.enum(["approved", "denied"]),
});

/** «Админка»: заявки и кто может входить. Только для админов (ALLOWED_EMAILS). */
export function mountAdmin(
  app: Hono<AuthEnv>,
  { db, auth, now }: { db: Db; auth: AuthConfig; now: () => Date },
) {
  app.use("/admin/*", async (c, next) => {
    const user = findUser(db, c.get("userId"));
    if (!user || !isAdminEmail(auth, user.email)) {
      return c.json({ error: "forbidden" }, 403);
    }
    return next();
  });

  app.get("/admin/access", (c) => {
    const people = db
      .select({
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        words: sql<number>`(select count(*) from ${words} where ${words.userId} = ${users.id})`,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .all();
    return c.json({
      admins: auth.mode === "google" ? [...auth.allowedEmails] : [auth.email],
      entries: listAccess(db),
      users: people.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  });

  // Одобрить или отклонить заявку; одобрить можно и почту без заявки (войдёт сразу).
  app.post("/admin/access", async (c) => {
    const parsed = decisionSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success) return c.json({ error: "bad request" }, 400);
    if (isAdminEmail(auth, parsed.data.email)) {
      return c.json({ error: "admin is set on the server" }, 409);
    }
    decideAccess(db, parsed.data.email, parsed.data.status, now());
    return c.json({ ok: true });
  });

  app.post("/admin/access/remove", async (c) => {
    const parsed = z
      .object({ email: emailSchema })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "bad request" }, 400);
    removeAccess(db, parsed.data.email);
    return c.body(null, 204);
  });
}
