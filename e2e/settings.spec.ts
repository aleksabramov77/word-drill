import { expect, test } from "@playwright/test";

test("настройки: меню разделов, раздел и назад, конфиденциальность внутри приложения", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await expect(page.getByText(/^Версия от /)).toBeVisible();

  await page.getByRole("link", { name: /Расписание/ }).click();
  await expect(page).toHaveURL(/\/settings\/schedule$/);
  await expect(page.getByRole("heading", { name: "Расписание" })).toBeVisible();
  await page.getByRole("link", { name: "Настройки" }).first().click();
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("link", { name: /Конфиденциальность/ }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { name: "Конфиденциальность" }),
  ).toBeVisible();
  // Нижнее меню приложения на месте — страница открылась внутри приложения.
  await expect(page.getByRole("link", { name: "Слова" })).toBeVisible();
});
