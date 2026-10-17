import { expect, test } from "@playwright/test";

test("входящие: текст скриншота → подсказка пары → добавить; токен для «Команд»", async ({
  page,
}) => {
  await page.goto("/words?tab=inbox");
  await page
    .getByLabel("Текст для разбора")
    .fill("09:41\nПереведите\nмолоко\nmilk\nПРОДОЛЖИТЬ");
  await page.getByRole("button", { name: "Разобрать" }).click();

  // Пара найдена: русская форма со скриншота уже выбрана для вопроса.
  const suggestion = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Добавить milk" }) });
  await expect(
    suggestion.getByRole("button", { name: "молоко" }),
  ).toBeVisible();
  await suggestion.getByRole("button", { name: "Добавить milk" }).click();
  await expect(page.getByText("Добавлено: молоко — milk")).toBeVisible();
  await expect(
    page.getByText("молоко — milk", { exact: false }).last(),
  ).toBeVisible();

  // Токен показывается один раз.
  await page.getByRole("link", { name: "Настройки" }).click();
  await page.getByRole("button", { name: "Создать токен" }).click();
  await expect(page.locator("code").filter({ hasText: /^wd_/ })).toBeVisible();
  await expect(page.getByText(/^wd_.{4}… · создан/)).toBeVisible();
});
