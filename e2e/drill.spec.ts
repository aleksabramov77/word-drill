import { expect, test } from "@playwright/test";

test("добавить слова и пройти лестницу: ввод → выбор → показ, опечатка", async ({
  page,
}) => {
  // Слово из словаря курса.
  await page.goto("/words");
  await page.getByLabel("Поиск в словаре").fill("кровь");
  await page.getByRole("button", { name: "Добавить blood", exact: true }).click();
  await expect(page.getByText("Добавлено: кровь — blood")).toBeVisible();

  // Слово вручную.
  await page.getByRole("tab", { name: "Вручную" }).click();
  await page.getByLabel("По-русски").fill("вода");
  await page.getByLabel("По-английски").fill("water");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText("Мои слова (2)")).toBeVisible();

  // Тренировка: первое добавленное — «кровь».
  await page.getByRole("link", { name: "Тренировка" }).click();
  await expect(page.getByRole("heading", { name: "кровь" })).toBeVisible();
  await expect(page.getByText("5 букв")).toBeVisible();

  const answer = page.getByLabel("Ответ по-английски");
  await answer.fill("xyz");
  await page.getByRole("button", { name: "Проверить" }).click();

  // Выбор из 4 вариантов — выбираем неправильный.
  await expect(page.getByText("Не то — выбери правильный вариант")).toBeVisible();
  const options = page.locator(".grid button");
  await expect(options).toHaveCount(4);
  await expect(options.filter({ hasText: /^blood$/ })).toHaveCount(1);
  await options.filter({ hasNotText: /^blood$/ }).first().click();

  // Показ: надо переписать без ошибок.
  await expect(page.getByText("Правильный ответ — перепиши")).toBeVisible();
  await page.getByLabel("Ответ по-английски").fill("blod");
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByLabel("Ответ по-английски")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Ответ по-английски").fill("blood");
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByText("Запомни:")).toBeVisible();
  await expect(page.getByText("снова через 1 минуту")).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();

  // «вода» с опечаткой — засчитано, но «с ошибками».
  await expect(page.getByRole("heading", { name: "вода" })).toBeVisible();
  await page.getByLabel("Ответ по-английски").fill("watr");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Почти! Знаешь, но с ошибкой")).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();

  await expect(page.getByText("Сейчас повторять нечего")).toBeVisible();

  // Статусы в списке.
  await page.getByRole("link", { name: "Слова", exact: true }).click();
  const water = page.getByRole("listitem").filter({ hasText: "вода — water" });
  await expect(water.getByText("с ошибками")).toBeVisible();
  const blood = page.getByRole("listitem").filter({ hasText: "кровь — blood" });
  await expect(blood.getByText("учится")).toBeVisible();
  await expect(blood.getByLabel("горячий круг")).toBeVisible();
});
