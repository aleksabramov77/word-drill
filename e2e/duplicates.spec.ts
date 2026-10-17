import { expect, test } from "@playwright/test";

test("повторное добавление: показывает уже добавленную карточку и даёт её убрать", async ({
  page,
}) => {
  await page.goto("/words?tab=manual");
  const fill = async (ru: string, en: string) => {
    await page.getByLabel("По-русски").fill(ru);
    await page.getByLabel("По-английски").fill(en);
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
  };

  await fill("сыр", "cheese");
  await expect(page.getByText("Добавлено: сыр — cheese")).toBeVisible();

  // Та же карточка ещё раз — вместо ошибки показываем её.
  await fill("Сыр", "cheese");
  const notice = page.getByTestId("existing-word");
  await expect(notice.getByText("Уже в списке:")).toBeVisible();
  await expect(notice.getByText("сыр", { exact: true })).toBeVisible();
  await notice.getByRole("button", { name: "Убрать из списка" }).click();
  await expect(page.getByText("Убрано: сыр")).toBeVisible();
  await expect(notice).toBeHidden();
  await expect(
    page.getByRole("listitem").filter({ hasText: "сыр — cheese" }),
  ).toHaveCount(0);

  // Слово из словаря: «Добавлено» + «Убрать» — и снова «Добавить».
  await page.getByRole("tab", { name: "Поиск" }).click();
  await page.getByLabel("Поиск в словаре").fill("кофе");
  await page
    .getByRole("button", { name: "Добавить coffee", exact: true })
    .click();
  await expect(page.getByText("Добавлено", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Убрать coffee" }).click();
  await expect(page.getByText("Убрано: кофе")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Добавить coffee", exact: true }),
  ).toBeVisible();
});
