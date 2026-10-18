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

  // «кровь»: не вспомнил → число букв → шаблон → буквы.
  await page.getByRole("link", { name: "Тренировка" }).click();
  await expect(page.getByRole("heading", { name: "кровь" })).toBeVisible();
  // При первом вводе длину слова не подсказываем.
  await expect(page.getByText("5 букв")).toBeHidden();
  // Пустой ответ не отправить: случайный Enter не засчитывается как «Не помню».
  await expect(page.getByRole("button", { name: "Проверить" })).toBeDisabled();
  await page.getByLabel("Ответ по-английски").press("Enter");
  await expect(page.getByText("Подсказка:")).toBeHidden();
  await page.getByRole("button", { name: "Не помню" }).click();

  // Подсказка 1 — только число букв.
  await expect(page.getByText("Подсказка:")).toBeVisible();
  await expect(page.getByTestId("length-hint")).toHaveText("5 букв");

  // Подсказка 2 — шаблон из 5 клеток, ввод прямо в клетки.
  await page.getByRole("button", { name: "Шаблон" }).click();
  const mask = page.getByTestId("hint-mask");
  const cells = mask.getByRole("textbox");
  await expect(cells).toHaveCount(5);
  await expect(page.getByText("Подсказок: 0.")).toBeVisible();

  // Верно вписанную «b» подсказка не трогает — открывает другую букву, красную, в неё не ввести.
  await page.getByLabel("Буква 1").click();
  await page.keyboard.type("b");
  await page.getByRole("button", { name: "Ещё буква" }).click();
  await expect(page.getByText("Подсказок: 1.")).toBeVisible();
  await expect(page.getByLabel("Буква 1")).toHaveValue("b");
  await expect(mask.locator("[data-revealed]")).toHaveCount(1);
  await expect(cells).toHaveCount(4);

  // Касание любой клетки ставит туда курсор, дальше курсор сам идёт вправо (открытую букву перескакивает).
  await cells.nth(1).click();
  await page.keyboard.type("xx");
  await expect(cells.nth(1)).toHaveValue("x");
  await expect(cells.nth(2)).toHaveValue("x");
  await expect(cells.nth(3)).toBeFocused();
  // Неверная попытка открывает ещё букву — и снова не на месте верной «b».
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Не то — открыл ещё одну букву:")).toBeVisible();
  await expect(page.getByText("Подсказок: 2.")).toBeVisible();
  await expect(page.getByLabel("Буква 1")).toHaveValue("b");

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
  await expect(page.getByTestId("length-hint")).toHaveText("11 букв");
  // Неверная попытка на числе букв — дальше шаблон.
  await page.getByLabel("Ответ по-английски").fill("frust");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Не то — вот шаблон слова:")).toBeVisible();
  await expect(cells).toHaveCount(11);
  await page.getByRole("button", { name: "Ещё буква" }).click();
  await expect(mask.locator("[data-revealed]")).toHaveText("f");
  // Ввод с первой клетки: открытая «f» пропускается.
  await page.getByLabel("Буква 2").click();
  await page.keyboard.type("rustration");
  await page.keyboard.press("Enter");
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
