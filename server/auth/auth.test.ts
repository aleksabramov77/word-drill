import { describe, expect, it } from "vitest";
import { createTestApp } from "../testing.ts";
import { parseEmails, readAuthConfig } from "./config.ts";
import type { Identity, IdentityProvider } from "./google.ts";

const auth = {
  mode: "google",
  clientId: "id",
  clientSecret: "secret",
  siteUrl: "https://words.example",
  allowedEmails: new Set(["me@gmail.com", "kid@gmail.com"]),
  secureCookies: true,
} as const;

function fakeGoogle(person: Partial<Identity> = {}): IdentityProvider {
  return {
    authorizationUrl: (state) =>
      new URL(`https://accounts.google.test/auth?state=${state}`),
    identify: async (code) => {
      if (code !== "good-code") throw new Error("bad code");
      return {
        sub: "123",
        email: "me@gmail.com",
        emailVerified: true,
        name: "Me",
        ...person,
      };
    },
  };
}

/** Cookie из Set-Cookie ответа → строка для заголовка Cookie запроса. */
function cookies(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c?.endsWith("="))
    .join("; ");
}

async function login(app: ReturnType<typeof createTestApp>["app"]) {
  const start = await app.request("/api/auth/google");
  expect(start.status).toBe(302);
  const state = new URL(start.headers.get("location") ?? "").searchParams.get(
    "state",
  );
  return app.request(
    `/api/auth/google/callback?state=${state}&code=good-code`,
    { headers: { Cookie: cookies(start) } },
  );
}

describe("вход через Google", () => {
  it("без входа API закрыт, health открыт", async () => {
    const { app } = createTestApp({ auth, identity: fakeGoogle() });
    expect((await app.request("/api/words")).status).toBe(401);
    expect((await app.request("/api/auth/me")).status).toBe(401);
    expect((await app.request("/api/health")).status).toBe(200);
  });

  it("разрешённая почта: сессия в cookie, свои слова", async () => {
    const { app } = createTestApp({ auth, identity: fakeGoogle() });
    const callback = await login(app);
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/");
    const setCookie = callback.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/wd_session=.+HttpOnly/);
    expect(setCookie).toMatch(/Secure/);

    const session = { headers: { Cookie: cookies(callback) } };
    const me = await app.request("/api/auth/me", session);
    expect(await me.json()).toEqual({
      user: { email: "me@gmail.com", name: "Me" },
      mode: "google",
      isAdmin: true,
    });
    expect((await app.request("/api/words", session)).status).toBe(200);

    const logout = await app.request("/api/auth/logout", {
      method: "POST",
      ...session,
    });
    expect(logout.status).toBe(204);
    expect((await app.request("/api/words", session)).status).toBe(401);
  });

  it("слова разных пользователей не пересекаются", async () => {
    const google = fakeGoogle();
    const { app } = createTestApp({ auth, identity: google });
    const mine = { headers: { Cookie: cookies(await login(app)) } };
    await app.request("/api/words", {
      method: "POST",
      headers: { ...mine.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "кровь", answers: ["blood"] }),
    });

    google.identify = async () => ({
      sub: "456",
      email: "kid@gmail.com",
      emailVerified: true,
      name: "Kid",
    });
    const kid = { headers: { Cookie: cookies(await login(app)) } };
    const kidWords = await (await app.request("/api/words", kid)).json();
    expect(kidWords.words).toEqual([]);
    const myWords = await (await app.request("/api/words", mine)).json();
    expect(myWords.words).toHaveLength(1);
  });

  it("неподтверждённая почта — отказ", async () => {
    const { app } = createTestApp({
      auth,
      identity: fakeGoogle({ emailVerified: false }),
    });
    const res = await login(app);
    expect(res.headers.get("location")).toBe("/login?error=forbidden");
    expect(cookies(res)).not.toContain("wd_session");
  });

  it("незнакомая почта → заявка и пуш админу; админ одобряет — входит; отклоняет — сессии закрыты", async () => {
    const sent: { endpoint: string; title: string; body: string }[] = [];
    const pusher = {
      publicKey: "k",
      send: async (
        t: { endpoint: string },
        p: { title: string; body: string },
      ) => {
        sent.push({ endpoint: t.endpoint, title: p.title, body: p.body });
        return { ok: true as const };
      },
    };
    const google = fakeGoogle();
    const { app } = createTestApp({ auth, identity: google, pusher });
    const admin = { headers: { Cookie: cookies(await login(app)) } };
    await app.request("/api/push/subscribe", {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: {
          endpoint: "https://push.example/admin",
          keys: { p256dh: "p", auth: "a" },
        },
      }),
    });

    const stranger = {
      sub: "999",
      email: "friend@gmail.com",
      emailVerified: true,
      name: "Friend",
    };
    google.identify = async () => stranger;
    const first = await login(app);
    expect(first.headers.get("location")).toBe("/login?status=pending");
    expect(cookies(first)).not.toContain("wd_session");
    expect(sent).toEqual([
      {
        endpoint: "https://push.example/admin",
        title: "Заявка на вход в Word Drill",
        body: "Friend · friend@gmail.com",
      },
    ]);
    await login(app); // повторная попытка до решения — без второго пуша
    expect(sent).toHaveLength(1);

    const list = await (await app.request("/api/admin/access", admin)).json();
    expect(list.admins).toEqual(["me@gmail.com", "kid@gmail.com"]);
    expect(list.entries).toMatchObject([
      { email: "friend@gmail.com", name: "Friend", status: "pending" },
    ]);

    const decide = (status: string) =>
      app.request("/api/admin/access", {
        method: "POST",
        headers: { ...admin.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ email: "friend@gmail.com", status }),
      });
    expect((await decide("approved")).status).toBe(200);
    const approved = await login(app);
    expect(approved.headers.get("location")).toBe("/");
    const friend = { headers: { Cookie: cookies(approved) } };
    expect((await app.request("/api/words", friend)).status).toBe(200);
    // не админ — в админку нельзя
    expect((await app.request("/api/admin/access", friend)).status).toBe(403);
    expect(
      (await (await app.request("/api/auth/me", friend)).json()).isAdmin,
    ).toBe(false);

    expect((await decide("denied")).status).toBe(200);
    expect((await app.request("/api/words", friend)).status).toBe(401);
    expect((await login(app)).headers.get("location")).toBe(
      "/login?error=forbidden",
    );
  });

  it("админ может заранее одобрить почту — человек входит без заявки", async () => {
    const google = fakeGoogle();
    const { app } = createTestApp({ auth, identity: google });
    const admin = { headers: { Cookie: cookies(await login(app)) } };
    await app.request("/api/admin/access", {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email: " Wife@Gmail.com ", status: "approved" }),
    });
    google.identify = async () => ({
      sub: "777",
      email: "wife@gmail.com",
      emailVerified: true,
      name: "",
    });
    expect((await login(app)).headers.get("location")).toBe("/");
  });

  it("state не совпал — отказ", async () => {
    const { app } = createTestApp({ auth, identity: fakeGoogle() });
    const start = await app.request("/api/auth/google");
    const res = await app.request(
      "/api/auth/google/callback?state=forged&code=good-code",
      { headers: { Cookie: cookies(start) } },
    );
    expect(res.headers.get("location")).toBe("/login?error=state");
  });

  it("dev-режим: все запросы от локального пользователя", async () => {
    const { app } = createTestApp();
    expect((await app.request("/api/words")).status).toBe(200);
    expect((await (await app.request("/api/auth/me")).json()).mode).toBe("dev");
  });
});

describe("настройки входа", () => {
  it("почты через запятую и пробелы, без регистра", () => {
    expect([...parseEmails(" Me@Gmail.com, kid@gmail.com\nx@y.z ")]).toEqual([
      "me@gmail.com",
      "kid@gmail.com",
      "x@y.z",
    ]);
  });

  it("без Google: dev локально, ошибка в проде (кроме e2e)", () => {
    expect(readAuthConfig({}).mode).toBe("dev");
    expect(() => readAuthConfig({ NODE_ENV: "production" })).toThrow();
    expect(
      readAuthConfig({ NODE_ENV: "production", ALLOW_DEV_AUTH: "1" }).mode,
    ).toBe("dev");
  });

  it("Google без списка почт — ошибка", () => {
    expect(() =>
      readAuthConfig({
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "s",
        SITE_URL: "https://x.example",
      }),
    ).toThrow();
    const config = readAuthConfig({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "s",
      SITE_URL: "https://x.example/",
      ALLOWED_EMAILS: "me@gmail.com",
    });
    expect(config).toMatchObject({
      mode: "google",
      siteUrl: "https://x.example",
      secureCookies: true,
    });
  });
});
