import { appendFile, readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// Сервер раздаёт сборку с диска (dist/client), поэтому «новую версию» можно сделать, поменяв sw.js.
const SW_FILE = "dist/client/sw.js";

test("вышла новая версия → плашка «Обновить» → новый service worker и перезагрузка", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ещё", exact: true }).waitFor();
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.active,
  );
  await expect(page.getByText("Вышло обновление Word Drill")).toBeHidden();

  const original = await readFile(SW_FILE, "utf8");
  try {
    await appendFile(SW_FILE, `\n// новая версия ${Date.now()}\n`);
    // Возврат в приложение — оно проверяет, нет ли новой версии.
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await expect(page.getByText("Вышло обновление Word Drill")).toBeVisible({
      timeout: 15_000,
    });

    const reloaded = page.waitForEvent("load");
    await page.getByRole("button", { name: "Обновить" }).click();
    await reloaded;
    await expect(page.getByText("Вышло обновление Word Drill")).toBeHidden();
    const scriptUrl = await page.evaluate(
      async () =>
        (await navigator.serviceWorker.getRegistration())?.active?.scriptURL,
    );
    expect(scriptUrl).toMatch(/\/sw\.js$/);
    const waiting = await page.evaluate(
      async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
    );
    expect(waiting).toBe(false);
  } finally {
    await writeFile(SW_FILE, original);
  }
});
