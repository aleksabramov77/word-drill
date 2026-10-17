import { expect, type Page, test } from "@playwright/test";

async function addManual(page: Page, prompt: string, answers: string) {
  await page.getByLabel("По-русски").fill(prompt);
  await page.getByLabel("По-английски").fill(answers);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText(`Добавлено: ${prompt}`)).toBeVisible();
}

test("лестница: ввод → подсказки по буквам → варианты → показ; опечатка; ответ с подсказкой", async ({
  page,
}) => {
  // Слово из словаря курса.
  await page.goto("/words");
  await page.getByLabel("Поиск в словаре").fill("кровь");
  await page
    .getByRole("button", { name: "Добавить blood", exact: true })
    .click();
  await expect(page.getByText("Добавлено: кровь — blood")).toBeVisible();

  // Слова вручную.
  await page.getByRole("tab", { name: "Вручную" }).click();
  await addManual(page, "вода", "water");
  await addManual(page, "разочарование", "frustration");
  await expect(page.getByText("Мои слова (3)")).toBeVisible();

  // «кровь»: не вспомнил → заготовка из 5 клеток.
  await page.getByRole("link", { name: "Тренировка" }).click();
  await expect(page.getByRole("heading", { name: "кровь" })).toBeVisible();
  await expect(page.getByText("5 букв")).toBeVisible();
  await page.getByRole("button", { name: "Не помню" }).click();

  const mask = page.getByTestId("hint-mask");
  await expect(page.getByText("Вспомни по подсказке:")).toBeVisible();
  await expect(mask.locator("span")).toHaveCount(5);
  await expect(page.getByText("Подсказок: 0.")).toBeVisible();

  // «Ещё буква» — первая буква.
  await page.getByRole("button", { name: "Ещё буква" }).click();
  await expect(mask).toContainText("b");
  await expect(page.getByText("Подсказок: 1.")).toBeVisible();

  // Неверная попытка открывает ещё букву.
  await page.getByLabel("Ответ по-английски").fill("bxx");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Не то — открыл ещё одну букву:")).toBeVisible();
  await expect(page.getByText("Подсказок: 2.")).toBeVisible();

  // «Варианты» → выбор из 4, выбираем неправильный.
  await page.getByRole("button", { name: "Варианты" }).click();
  const options = page.getByTestId("choices").getByRole("button");
  await expect(options).toHaveCount(4);
  await expect(options.filter({ hasText: /^blood$/ })).toHaveCount(1);
  await options
    .filter({ hasNotText: /^blood$/ })
    .first()
    .click();

  // Показ: переписать без ошибок.
  await expect(page.getByText("Правильный ответ — перепиши")).toBeVisible();
  await page.getByLabel("Ответ по-английски").fill("blod");
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByText("Не совпало — перепиши точно:")).toBeVisible();
  await page.getByLabel("Ответ по-английски").fill("blood");
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByText("Запомни:")).toBeVisible();
  await expect(page.getByText(/снова через 1 минуту/)).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();

  // «вода» с опечаткой — засчитано, но «с ошибками».
  await expect(page.getByRole("heading", { name: "вода" })).toBeVisible();
  await page.getByLabel("Ответ по-английски").fill("watr");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Почти! Знаешь, но с ошибкой")).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();

  // «разочарование»: ошибся → одна буква → вспомнил (Hard — «с ошибками»).
  await expect(
    page.getByRole("heading", { name: "разочарование" }),
  ).toBeVisible();
  await page.getByLabel("Ответ по-английски").fill("frustr");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(mask.locator("span")).toHaveCount(11);
  await page.getByRole("button", { name: "Ещё буква" }).click();
  await expect(mask).toContainText("f");
  await page.getByLabel("Ответ по-английски").fill("frustration");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Верно, с подсказкой")).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();

  await expect(page.getByText("Сейчас повторять нечего")).toBeVisible();

  // Статусы и «знание» в списке.
  await page.getByRole("link", { name: "Слова", exact: true }).click();
  const row = (text: string) =>
    page.getByRole("listitem").filter({ hasText: text });
  await expect(row("вода — water").getByText("с ошибками")).toBeVisible();
  await expect(
    row("разочарование — frustration").getByText("с ошибками"),
  ).toBeVisible();
  await expect(row("кровь — blood").getByText("учится")).toBeVisible();
  await expect(row("кровь — blood").getByLabel("горячий круг")).toBeVisible();
  await expect(row("кровь — blood").getByText(/знание \d+%/)).toBeVisible();
});
