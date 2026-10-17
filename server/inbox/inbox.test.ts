import { describe, expect, it } from "vitest";
import { fixtureDictionary } from "../dictionary/fixture.ts";
import { createTestApp } from "../testing.ts";
import { containsWord, suggestWords } from "./suggest.ts";

const json = (data: unknown, method = "POST", headers = {}) => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(data),
});

// Так OCR видит карточку Duolingo «быстро переведи»: русское слово и ответ.
const duolingoScreen = `09:41
Переведите
кровь
blood
ПРОДОЛЖИТЬ`;

describe("suggestWords", () => {
  it("целое слово, не часть другого", () => {
    expect(containsWord("my blood type", "blood")).toBe(true);
    expect(containsWord("bloody mess", "blood")).toBe(false);
    expect(containsWord("лёд и вода", "лёд")).toBe(true);
  });

  it("пара «кровь → blood» со скриншота Duolingo", () => {
    const [first] = suggestWords(fixtureDictionary, duolingoScreen, new Set());
    expect(first?.word.en).toBe("blood");
    expect(first?.matchedRu).toBe("кровь");
  });

  it("пары выше одиночных; короткие одиночные — шум; уже добавленные не предлагаются", () => {
    const text = "Blood pressure, кровяное давление. Ice, milk";
    const all = suggestWords(fixtureDictionary, text, new Set());
    expect(all.map((s) => [s.word.en, s.matchedRu])).toEqual([
      ["blood pressure", "кровяное давление"],
      ["blood", null],
      ["milk", null],
    ]);
    expect(
      suggestWords(fixtureDictionary, text, new Set(["blood pressure"])).map(
        (s) => s.word.en,
      ),
    ).toEqual(["blood", "milk"]);
  });
});

describe("входящие и личный токен", () => {
  it("«Команды» iOS: токен → текст скриншота → подсказка; без токена — 401 в режиме Google", async () => {
    const auth = {
      mode: "google",
      clientId: "id",
      clientSecret: "s",
      siteUrl: "https://words.example",
      allowedEmails: new Set(["me@gmail.com"]),
      secureCookies: true,
    } as const;
    const { app, db, userId } = createTestApp({ auth });
    const { createApiToken } = await import("../auth/tokens.ts");
    const token = createApiToken(db, userId, new Date());
    expect(token).toMatch(/^wd_/);

    expect(
      (await app.request("/api/inbox", { method: "POST", body: "x" })).status,
    ).toBe(401);
    expect(
      (
        await app.request("/api/inbox", {
          method: "POST",
          body: "x",
          headers: { Authorization: "Bearer wd_wrong" },
        })
      ).status,
    ).toBe(401);

    // text/plain — как шлёт действие «Команд» с телом-файлом
    const created = await app.request("/api/inbox", {
      method: "POST",
      body: duolingoScreen,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
    });
    expect(created.status).toBe(201);
    const { item } = await created.json();
    expect(item.suggestions[0]).toMatchObject({
      word: { en: "blood" },
      matchedRu: "кровь",
    });

    const list = await (
      await app.request("/api/inbox", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    expect(list.items).toHaveLength(1);
  });

  it("добавленное слово пропадает из подсказок; запись удаляется", async () => {
    const { app } = createTestApp();
    const { item } = await (
      await app.request("/api/inbox", json({ text: duolingoScreen }))
    ).json();
    await app.request(
      "/api/words",
      json({ prompt: "кровь", answers: ["blood"] }),
    );
    const list = await (await app.request("/api/inbox")).json();
    expect(list.items[0].suggestions).toEqual([]);
    expect(
      (await app.request(`/api/inbox/${item.id}`, { method: "DELETE" })).status,
    ).toBe(204);
    expect((await (await app.request("/api/inbox")).json()).items).toEqual([]);
  });

  it("токены: создать, список без самого токена, удалить", async () => {
    const { app } = createTestApp();
    const { token } = await (
      await app.request("/api/tokens", { method: "POST" })
    ).json();
    const { tokens } = await (await app.request("/api/tokens")).json();
    expect(tokens).toHaveLength(1);
    expect(JSON.stringify(tokens)).not.toContain(token);
    expect(token.startsWith(tokens[0].prefix)).toBe(true);
    expect(
      (await app.request(`/api/tokens/${tokens[0].id}`, { method: "DELETE" }))
        .status,
    ).toBe(204);
  });

  it("пустой текст — 400", async () => {
    const { app } = createTestApp();
    expect((await app.request("/api/inbox", json({ text: "  " }))).status).toBe(
      400,
    );
  });
});
