import { appendFile, readFile, writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import pkg from "../package.json" with { type: "json" };

// Сервер раздаёт сборку с диска (dist/client), поэтому «новую версию» можно сделать, поменяв sw.js.
const SW_FILE = "dist/client/sw.js";
const BANNER = "Вышло обновление Word Drill";

async function openApp(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Ещё", exact: true }).waitFor();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function withNewVersion(run: () => Promise<void>) {
  const original = await readFile(SW_FILE, "utf8");
  try {
    await appendFile(SW_FILE, `\n// новая версия ${Date.now()}\n`);
    await run();
  } finally {
    await writeFile(SW_FILE, original);
  }
}

const activeScript = (page: Page) =>
  page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { active: !!r?.active, waiting: !!r?.waiting };
  });

test("вернулся в приложение, а там новая версия → обновляется само, без плашки", async ({
  page,
}) => {
  await openApp(page);
  await withNewVersion(async () => {
    const reloaded = page.waitForEvent("load");
    // Возврат в приложение: проверка новой версии, а она сразу включается.
    await page.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await reloaded;
    await expect(page.getByText(BANNER)).toBeHidden();
    expect(await activeScript(page)).toEqual({ active: true, waiting: false });
  });
});

test("новая версия пришла посреди работы → плашка «Обновить» → перезагрузка", async ({
  page,
}) => {
  await openApp(page);
  // Прошло больше 10 секунд с открытия — сама страница уже не перезагрузится.
  await page.waitForTimeout(10_500);
  await withNewVersion(async () => {
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())?.update();
    });
    await expect(page.getByText(BANNER)).toBeVisible({ timeout: 15_000 });
    const reloaded = page.waitForEvent("load");
    await page.getByRole("button", { name: "Обновить" }).click();
    await reloaded;
    await expect(page.getByText(BANNER)).toBeHidden();
  });
});

test("«Ещё» → «Проверить наличие обновлений»: уже последняя версия", async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole("link", { name: "Ещё", exact: true }).click();
  await page
    .getByRole("button", { name: "Проверить наличие обновлений" })
    .click();
  await expect(
    page.getByText(`У тебя последняя версия ${pkg.version}`),
  ).toBeVisible();
});

test("«Проверить наличие обновлений»: на сервере новее → кэш удалён, страница перезагружена", async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole("link", { name: "Ещё", exact: true }).click();
  expect(
    await page.evaluate(async () => (await caches.keys()).length),
  ).toBeGreaterThan(0);
  // Сервер «сообщает» более новую версию.
  await page.route("**/api/health", (route) =>
    route.fulfill({ json: { ok: true, version: "99.0.0" } }),
  );
  const reloaded = page.waitForEvent("load");
  await page
    .getByRole("button", { name: "Проверить наличие обновлений" })
    .click();
  await reloaded;
  await page.getByRole("link", { name: "Ещё", exact: true }).waitFor();
  // Service worker не удалён (вместе с ним пропала бы подписка на уведомления) — управляет страницей.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
});
