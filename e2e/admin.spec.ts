import { expect, test } from "@playwright/test";

test("админка: пустить почту заранее и закрыть доступ", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("link", { name: "Админка: заявки и доступ" }).click();
  await expect(page.getByRole("heading", { name: "Заявки (0)" })).toBeVisible();

  await page.getByLabel("Почта Google").fill("Friend@Gmail.com");
  await page.getByRole("button", { name: "Пустить", exact: true }).click();
  await expect(page.getByText("Пускаем: Friend@Gmail.com")).toBeVisible();
  // В «Могут входить» — уже в нижнем регистре, с кнопкой «Закрыть».
  const close = page.getByRole("button", {
    name: "Закрыть доступ friend@gmail.com",
  });
  await expect(close).toBeVisible();
  await close.click();
  await expect(
    page.getByRole("heading", { name: "Отклонённые" }),
  ).toBeVisible();

  // Поиск по заявкам и доступу.
  await page.getByLabel("Поиск по заявкам").fill("FRIEND");
  await expect(
    page.getByText("friend@gmail.com", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Поиск по заявкам").fill("nobody");
  await expect(page.getByText("Ничего не нашлось.")).toBeVisible();
  await expect(
    page.getByText("friend@gmail.com", { exact: true }),
  ).toBeHidden();
});
