import { describe, expect, it } from "vitest";
import { createTestApp } from "../testing.ts";
import type { PushPayload, PushSender } from "./sender.ts";
import { announceUpdate, needsUpdateNotice } from "./update.ts";

function fakeSender() {
  const sent: PushPayload[] = [];
  const sender: PushSender = {
    publicKey: "public-key",
    send: async (_target, payload) => {
      sent.push(payload);
      return { ok: true };
    },
  };
  return { sender, sent };
}

// 12:00 и 23:30 по Москве.
const noon = new Date("2026-10-17T09:00:00Z");
const night = new Date("2026-10-17T20:30:00Z");

async function setup(appVersion?: string) {
  const { sender, sent } = fakeSender();
  const ctx = createTestApp({ start: noon, pusher: sender });
  const res = await ctx.app.request("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(appVersion ? { "X-App-Version": appVersion } : {}),
    },
    body: JSON.stringify({
      subscription: {
        endpoint: "https://push.example/1",
        keys: { p256dh: "p", auth: "a" },
      },
      timeZone: "Europe/Moscow",
    }),
  });
  expect(res.status).toBe(201);
  // Ещё один запрос — его версия запоминается (подписка могла пройти раньше middleware).
  await ctx.app.request("/api/words", {
    headers: appVersion ? { "X-App-Version": appVersion } : {},
  });
  return { ...ctx, sender, sent };
}

describe("уведомление «Word Drill обновился»", () => {
  it("кому: тем, у кого версия старее или неизвестна, и только раз на версию", () => {
    const fresh = { appVersion: null, updateNotifiedVersion: null };
    expect(needsUpdateNotice(fresh, "1.2.0")).toBe(true);
    expect(needsUpdateNotice({ ...fresh, appVersion: "1.1.0" }, "1.2.0")).toBe(
      true,
    );
    expect(needsUpdateNotice({ ...fresh, appVersion: "1.2.0" }, "1.2.0")).toBe(
      false,
    );
    expect(needsUpdateNotice({ ...fresh, appVersion: "1.10.0" }, "1.9.0")).toBe(
      false,
    );
    expect(
      needsUpdateNotice(
        { appVersion: "1.1.0", updateNotifiedVersion: "1.2.0" },
        "1.2.0",
      ),
    ).toBe(false);
  });

  it("старое приложение получает одно уведомление на версию", async () => {
    const { db, sender, sent } = await setup("1.1.0");
    expect(await announceUpdate(db, sender, "1.2.0", noon)).toBe(1);
    expect(sent).toEqual([
      expect.objectContaining({
        title: "Word Drill обновился",
        url: "/",
        tag: "update",
      }),
    ]);
    expect(await announceUpdate(db, sender, "1.2.0", noon)).toBe(0);
    expect(await announceUpdate(db, sender, "1.3.0", noon)).toBe(1);
  });

  it("у кого уже новая версия — не зовём", async () => {
    const { db, sender, sent } = await setup("1.2.0");
    expect(await announceUpdate(db, sender, "1.2.0", noon)).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("ночью ждёт утра", async () => {
    const { db, sender } = await setup("1.1.0");
    expect(await announceUpdate(db, sender, "1.2.0", night)).toBe(0);
    expect(await announceUpdate(db, sender, "1.2.0", noon)).toBe(1);
  });
});
