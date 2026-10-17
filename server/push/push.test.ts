import { describe, expect, it } from "vitest";
import { addWord } from "../drill/service.ts";
import { createTestApp } from "../testing.ts";
import type { PushPayload, PushSender, PushTarget } from "./sender.ts";
import { pushTick } from "./service.ts";

const MINUTE = 60_000;

function fakeSender(gone = new Set<string>()) {
  const sent: { target: PushTarget; payload: PushPayload }[] = [];
  const sender: PushSender = {
    publicKey: "public-key",
    send: async (target, payload) => {
      if (gone.has(target.endpoint)) return { ok: false, gone: true };
      sent.push({ target, payload });
      return { ok: true };
    },
  };
  return { sender, sent };
}

const json = (data: unknown, method = "POST") => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

const subscription = (endpoint: string) => ({
  subscription: { endpoint, keys: { p256dh: "p", auth: "a" } },
  timeZone: "Europe/Moscow",
});

// 12:00 по Москве.
const noon = new Date("2026-10-17T09:00:00Z");

async function setup() {
  const { sender, sent } = fakeSender();
  const ctx = createTestApp({ start: noon, pusher: sender });
  const res = await ctx.app.request(
    "/api/push/subscribe",
    json(subscription("https://push.example/1")),
  );
  expect(res.status).toBe(201);
  const add = (prompt: string, en: string) => {
    const word = addWord(
      ctx.db,
      ctx.userId,
      { prompt, answers: [en], source: "manual" },
      ctx.clock.now(),
    );
    if (word === "duplicate") throw new Error("duplicate");
    return word;
  };
  const tick = () => pushTick(ctx.db, sender, ctx.clock.now());
  return { ...ctx, sender, sent, add, tick };
}

describe("подписка и настройки", () => {
  it("config показывает ключ и число подписок; часовой пояс берётся из подписки", async () => {
    const { app } = await setup();
    expect(await (await app.request("/api/push/config")).json()).toEqual({
      enabled: true,
      publicKey: "public-key",
      subscriptions: 1,
    });
    const { settings } = await (await app.request("/api/settings")).json();
    expect(settings.timeZone).toBe("Europe/Moscow");
  });

  it("настройки: правка, проверка окна и часового пояса", async () => {
    const { app } = await setup();
    const ok = await app.request(
      "/api/settings",
      json({ windowStart: 8, minGapMinutes: 30 }, "PATCH"),
    );
    expect((await ok.json()).settings).toMatchObject({
      windowStart: 8,
      windowEnd: 22,
      minGapMinutes: 30,
    });
    expect(
      (await app.request("/api/settings", json({ windowEnd: 8 }, "PATCH")))
        .status,
    ).toBe(400);
    expect(
      (
        await app.request(
          "/api/settings",
          json({ timeZone: "Mars/Olympus" }, "PATCH"),
        )
      ).status,
    ).toBe(400);
  });

  it("без VAPID уведомления выключены", async () => {
    const { app } = createTestApp();
    expect((await (await app.request("/api/push/config")).json()).enabled).toBe(
      false,
    );
    expect(
      (
        await app.request(
          "/api/push/subscribe",
          json(subscription("https://push.example/x")),
        )
      ).status,
    ).toBe(503);
  });
});

describe("планировщик", () => {
  it("присылает новое слово, потом выдерживает паузу", async () => {
    const { add, tick, sent, clock } = await setup();
    const word = add("кровь", "blood");
    expect(await tick()).toEqual({ sent: 1 });
    expect(sent[0]?.payload).toEqual({
      title: "Как по-английски?",
      body: "кровь",
      url: `/?word=${word.id}`,
      tag: "word",
    });

    clock.advance(10 * MINUTE);
    expect(await tick()).toEqual({ sent: 0 });
  });

  it("без ответа пауза растёт; ответ её сбрасывает", async () => {
    const { add, tick, clock, app } = await setup();
    const word = add("кровь", "blood");
    expect((await tick()).sent).toBe(1); // 0 мин
    clock.advance(20 * MINUTE);
    expect((await tick()).sent).toBe(0); // одно без ответа — пауза уже 40 минут
    clock.advance(20 * MINUTE);
    expect((await tick()).sent).toBe(1); // 40 мин: второе
    clock.advance(60 * MINUTE);
    expect((await tick()).sent).toBe(0); // два без ответа — пауза 80 минут

    await app.request(
      `/api/drill/${word.id}/step`,
      json({ stage: "type", input: "" }),
    );
    clock.advance(1 * MINUTE);
    // ответил — пауза снова 20 минут от последнего уведомления (прошла 61 минута)
    expect((await tick()).sent).toBe(1);
  });

  it("не больше newPerDay новых слов в день", async () => {
    const { add, tick, clock, app } = await setup();
    await app.request("/api/settings", json({ newPerDay: 1 }, "PATCH"));
    add("кровь", "blood");
    add("вода", "water");
    expect((await tick()).sent).toBe(1);
    clock.advance(30 * MINUTE);
    expect((await tick()).sent).toBe(0); // второе новое — уже завтра
  });

  it("ночью молчит; исчезнувшая подписка удаляется", async () => {
    const gone = new Set(["https://push.example/1"]);
    const { sender } = fakeSender(gone);
    const ctx = createTestApp({ start: noon, pusher: sender });
    await ctx.app.request(
      "/api/push/subscribe",
      json(subscription("https://push.example/1")),
    );
    addWord(
      ctx.db,
      ctx.userId,
      { prompt: "кровь", answers: ["blood"], source: "manual" },
      noon,
    );
    expect(
      (await pushTick(ctx.db, sender, new Date("2026-10-17T20:00:00Z"))).sent,
    ).toBe(0); // 23:00 МСК
    expect((await pushTick(ctx.db, sender, noon)).sent).toBe(0);
    const config = await (await ctx.app.request("/api/push/config")).json();
    expect(config.subscriptions).toBe(0);
  });

  it("слово из уведомления открывается первым", async () => {
    const { add, app } = await setup();
    add("кровь", "blood");
    const second = add("вода", "water");
    const queue = await (
      await app.request(`/api/drill/next?word=${second.id}`)
    ).json();
    expect(queue.card.prompt).toBe("вода");
  });
});
