import { expect, test } from "@playwright/test";
import pkg from "../package.json" with { type: "json" };

test("«Ещё»: группы настроек и справки, раздел и назад, конфиденциальность внутри приложения", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ещё", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ещё" })).toBeVisible();
  for (const group of ["Настройки", "Справка", "О приложении"]) {
    await expect(page.getByRole("heading", { name: group })).toBeVisible();
  }
  await expect(
    page.getByText(
      new RegExp(`^Версия ${pkg.version.replaceAll(".", "\\.")} · от `),
    ),
  ).toBeVisible();

  await page.getByRole("link", { name: /Расписание/ }).click();
  await expect(page).toHaveURL(/\/more\/schedule$/);
  await expect(page.getByRole("heading", { name: "Расписание" })).toBeVisible();
  await page.getByRole("link", { name: "Ещё" }).first().click();
  await expect(page).toHaveURL(/\/more$/);

  await page.getByRole("link", { name: /Баллы и знание/ }).click();
  await expect(
    page.getByRole("heading", { name: "Баллы и знание" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Интервальные повторения — Википедия/ }),
  ).toHaveAttribute("href", /ru\.wikipedia\.org/);
  await page.getByRole("link", { name: "Ещё" }).first().click();

  await page.getByRole("link", { name: /Конфиденциальность/ }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { name: "Конфиденциальность" }),
  ).toBeVisible();
  // Нижнее меню приложения на месте — страница открылась внутри приложения.
  await expect(page.getByRole("link", { name: "Слова" })).toBeVisible();

  // Неизвестный раздел — обратно в меню.
  await page.goto("/more/nope");
  await expect(page).toHaveURL(/\/more$/);
});

test("«Поделиться» на Android: текст уходит во «Входящие»", async ({
  page,
}) => {
  await page.goto(
    `/share?title=${encodeURIComponent("Duolingo")}&text=${encodeURIComponent("Переведите\nсыр\ncheese")}`,
  );
  await expect(page).toHaveURL(/\/words\?tab=inbox$/);
  await expect(
    page.getByRole("button", { name: "Добавить cheese" }),
  ).toBeVisible();
  // Отправлено ровно один раз.
  const { items } = await (await page.request.get("/api/inbox")).json();
  expect(
    items.filter((i: { text: string }) => i.text.includes("cheese")),
  ).toHaveLength(1);
});
