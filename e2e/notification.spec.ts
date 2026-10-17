import { expect, type Page, test } from "@playwright/test";

async function addWord(page: Page, ru: string, en: string): Promise<number> {
  await page.goto("/words?tab=manual");
  await page.getByLabel("По-русски").fill(ru);
  await page.getByLabel("По-английски").fill(en);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText(`Добавлено: ${ru} — ${en}`)).toBeVisible();
  const { words } = await (await page.request.get("/api/words")).json();
  return words.find((w: { prompt: string }) => w.prompt === ru).id;
}

test("нажатие на уведомление при открытом приложении на другом экране → тренировка этого слова", async ({
  page,
  context,
}) => {
  const id = await addWord(page, "ветер", "wind");

  // Приложение открыто на «Ещё».
  await page.getByRole("link", { name: "Ещё", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ещё" })).toBeVisible();

  // Так service worker реагирует на нажатие уведомления (src/app/sw.ts → notificationclick).
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  await worker.evaluate(async (url) => {
    const sw = self as unknown as {
      clients: {
        matchAll: (
          o: object,
        ) => Promise<{ postMessage: (m: unknown) => void }[]>;
      };
    };
    const [win] = await sw.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    win?.postMessage({ type: "open-url", url });
  }, `/?word=${id}`);

  await expect(page).toHaveURL(new RegExp(`/\\?word=${id}$`));
  await expect(page.getByRole("heading", { name: "ветер" })).toBeVisible();
});

test("сообщение потерялось (iPhone будит приложение из фона) → переход по записи service worker при выходе на экран", async ({
  page,
}) => {
  const id = await addWord(page, "гора", "mountain");
  await page.getByRole("link", { name: "Ещё", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ещё" })).toBeVisible();

  // Так service worker записывает нажатие (src/app/sw.ts), а сообщение до страницы не дошло.
  await page.evaluate(async (url) => {
    const cache = await caches.open("pending-open");
    await cache.put(
      "/__pending-open",
      new Response(JSON.stringify({ url, at: Date.now() })),
    );
    document.dispatchEvent(new Event("visibilitychange"));
  }, `/?word=${id}`);

  await expect(page).toHaveURL(new RegExp(`/\\?word=${id}$`));
  await expect(page.getByRole("heading", { name: "гора" })).toBeVisible();
});

test("старая запись о нажатии (больше минуты) не уводит со страницы", async ({
  page,
}) => {
  const id = await addWord(page, "река", "river");
  await page.getByRole("link", { name: "Ещё", exact: true }).click();
  await page.evaluate(async (url) => {
    const cache = await caches.open("pending-open");
    await cache.put(
      "/__pending-open",
      new Response(JSON.stringify({ url, at: Date.now() - 120_000 })),
    );
    document.dispatchEvent(new Event("visibilitychange"));
  }, `/?word=${id}`);
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/more$/);
});
