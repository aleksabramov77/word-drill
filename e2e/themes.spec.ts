import { expect, test } from "@playwright/test";

test("темы курса: поиск по названию → слова темы → назад", async ({ page }) => {
  await page.goto("/words");
  await page.getByRole("tab", { name: "Темы" }).click();
  await page.getByLabel("Поиск темы курса").fill("брак");
  const theme = page.getByRole("button", {
    name: /Опиши подготовку к свадьбе/,
  });
  await expect(theme).toBeVisible();
  await expect(
    page.getByRole("button", { name: /бракованный товар/ }),
  ).toBeVisible();
  await theme.click();

  await expect(
    page.getByRole("heading", { name: "Брак: Опиши подготовку к свадьбе" }),
  ).toBeVisible();
  await expect(page.getByText("honeymoon", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Все темы" }).click();
  await expect(page.getByLabel("Поиск темы курса")).toHaveValue("брак");
});
