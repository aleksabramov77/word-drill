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
import { accessOf, requestAccess } from "./access.ts";
import type { AuthConfig } from "./config.ts";
import type { Identity, IdentityProvider } from "./google.ts";
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionUser,
} from "./sessions.ts";
import { apiTokenUser } from "./tokens.ts";

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
  /** Новая заявка на вход — уведомить админов. */
  onAccessRequest?: (person: Identity) => Promise<void> | void;
}

/** Админ — почта из ALLOWED_EMAILS (в dev-режиме — локальный пользователь). */
export function isAdminEmail(auth: AuthConfig, email: string): boolean {
  const key = email.toLowerCase();
  return auth.mode === "dev" ? key === auth.email : auth.allowedEmails.has(key);
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

/**
 * Кто делает запрос: личный токен (Authorization: Bearer — «Команды» iOS), cookie сессии (google)
 * или локальный пользователь (dev).
 */
function currentUserId(c: Context, deps: AuthDeps): string | null {
  const bearer = c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) return apiTokenUser(deps.db, bearer, deps.now());
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
      isAdmin: isAdminEmail(auth, user.email),
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
    if (!person.emailVerified) return c.redirect("/login?error=forbidden");
    if (!isAdminEmail(auth, person.email)) {
      const status = accessOf(db, person.email);
      if (status === "denied") return c.redirect("/login?error=forbidden");
      if (status !== "approved") {
        // Незнакомая почта — заявка админам; повторная попытка до решения — просто «ждите».
        if (requestAccess(db, person.email, person.name, now())) {
          await deps.onAccessRequest?.(person);
        }
        return c.redirect("/login?status=pending");
      }
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
