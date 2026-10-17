import { createApp } from "./app.ts";
import type { AuthConfig } from "./auth/config.ts";
import type { IdentityProvider } from "./auth/google.ts";
import { openDb } from "./db/client.ts";
import { fixtureDictionary } from "./dictionary/fixture.ts";
import type { PushSender } from "./push/sender.ts";
import { ensureUser, LOCAL_USER_ID } from "./users.ts";

/** Приложение на БД в памяти и маленьком словаре; время двигается вручную. */
export function createTestApp({
  start = new Date("2026-10-17T09:00:00Z"),
  auth,
  identity,
  pusher,
}: {
  start?: Date;
  auth?: AuthConfig;
  identity?: IdentityProvider;
  pusher?: PushSender;
} = {}) {
  const db = openDb(":memory:");
  ensureUser(db, LOCAL_USER_ID, "local@localhost", start);
  let current = start;
  const clock = {
    now: () => current,
    advance: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
  const app = createApp({
    db,
    dictionary: fixtureDictionary,
    auth,
    identity,
    pusher,
    now: clock.now,
  });
  return { app, db, clock, userId: LOCAL_USER_ID };
}
