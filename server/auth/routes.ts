import { generateCodeVerifier, generateState } from "arctic";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Db } from "../db/client.ts";
import {
  ensureGoogleUser,
  ensureUser,
  findUser,
  LOCAL_USER_ID,
} from "../users.ts";
import type { AuthConfig } from "./config.ts";
import type { IdentityProvider } from "./google.ts";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionUser,
} from "./sessions.ts";

export type AuthEnv = { Variables: { userId: string } };

const STATE_COOKIE = "wd_oauth_state";
const VERIFIER_COOKIE = "wd_oauth_verifier";
const OAUTH_COOKIE_SECONDS = 10 * 60;
/** Без входа доступны только эти пути. */
const PUBLIC_PATHS = ["/api/health", "/api/auth/"];

export interface AuthDeps {
  db: Db;
  auth: AuthConfig;
  identity?: IdentityProvider;
  now: () => Date;
}

function cookieOptions(auth: AuthConfig, maxAge: number) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: auth.mode === "google" && auth.secureCookies,
    maxAge,
  };
}

function devUserId(deps: AuthDeps): string {
  if (deps.auth.mode !== "dev") throw new Error("не dev-режим");
  return ensureUser(deps.db, LOCAL_USER_ID, deps.auth.email, deps.now());
}

/** Кто делает запрос: из cookie сессии (google) или локальный пользователь (dev). */
function currentUserId(c: Context, deps: AuthDeps): string | null {
  if (deps.auth.mode === "dev") return devUserId(deps);
  const token = getCookie(c, SESSION_COOKIE);
  return token ? sessionUser(deps.db, token, deps.now()) : null;
}

export function mountAuth(app: Hono<AuthEnv>, deps: AuthDeps) {
  const { db, auth, identity, now } = deps;

  app.use("*", async (c, next) => {
    if (PUBLIC_PATHS.some((path) => c.req.path.startsWith(path))) {
      return next();
    }
    const userId = currentUserId(c, deps);
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", userId);
    return next();
  });

  app.get("/auth/me", (c) => {
    const userId = currentUserId(c, deps);
    const user = userId ? findUser(db, userId) : undefined;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    return c.json({
      user: { email: user.email, name: user.name },
      mode: auth.mode,
    });
  });

  app.get("/auth/google", (c) => {
    if (auth.mode !== "google" || !identity) return c.redirect("/");
    const state = generateState();
    const verifier = generateCodeVerifier();
    setCookie(
      c,
      STATE_COOKIE,
      state,
      cookieOptions(auth, OAUTH_COOKIE_SECONDS),
    );
    setCookie(
      c,
      VERIFIER_COOKIE,
      verifier,
      cookieOptions(auth, OAUTH_COOKIE_SECONDS),
    );
    return c.redirect(identity.authorizationUrl(state, verifier).toString());
  });

  app.get("/auth/google/callback", async (c) => {
    if (auth.mode !== "google" || !identity) return c.redirect("/");
    const state = c.req.query("state");
    const code = c.req.query("code");
    const savedState = getCookie(c, STATE_COOKIE);
    const verifier = getCookie(c, VERIFIER_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/" });
    deleteCookie(c, VERIFIER_COOKIE, { path: "/" });
    if (!state || !code || !verifier || state !== savedState) {
      return c.redirect("/login?error=state");
    }

    let person: Awaited<ReturnType<IdentityProvider["identify"]>>;
    try {
      person = await identity.identify(code, verifier);
    } catch {
      return c.redirect("/login?error=google");
    }
    if (!person.emailVerified || !auth.allowedEmails.has(person.email)) {
      return c.redirect("/login?error=forbidden");
    }

    const userId = ensureGoogleUser(db, person, now());
    const token = createSession(db, userId, now());
    setCookie(
      c,
      SESSION_COOKIE,
      token,
      cookieOptions(auth, SESSION_DAYS * 24 * 60 * 60),
    );
    return c.redirect("/");
  });

  app.post("/auth/logout", (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) deleteSession(db, token);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });
}
