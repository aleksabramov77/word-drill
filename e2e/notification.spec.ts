import { expect, test } from "@playwright/test";

test("нажатие на уведомление при открытом приложении на другом экране → тренировка этого слова", async ({
  page,
  context,
}) => {
  await page.goto("/words?tab=manual");
  await page.getByLabel("По-русски").fill("ветер");
  await page.getByLabel("По-английски").fill("wind");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText("Добавлено: ветер — wind")).toBeVisible();
  const { words } = await (await page.request.get("/api/words")).json();
  const id = words.find((w: { prompt: string }) => w.prompt === "ветер").id;

  // Приложение открыто на «Настройках».
  await page.getByRole("link", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();

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
