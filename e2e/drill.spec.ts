import { expect, type Page, test } from "@playwright/test";
import Database from "better-sqlite3";

// База e2e-сервера (playwright.config.ts → DATABASE_PATH).
const DB_PATH = "test-results/e2e.db";

async function addManual(page: Page, prompt: string, answers: string) {
  await page.getByLabel("По-русски").fill(prompt);
  await page.getByLabel("По-английски").fill(answers);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText(`Добавлено: ${prompt}`)).toBeVisible();
}

/** Сделать слово «выученным» (знание ~70%) и пора повторить — оно спрашивается в обычном поле. */
function makeKnown(prompt: string) {
  const db = new Database(DB_PATH);
  try {
    const now = Date.now();
    db.prepare(
      `update words set
         card = json_set(card, '$.state', 2, '$.stability', 15, '$.difficulty', 5, '$.reps', 5,
                         '$.due', ?, '$.last_review', ?),
         due = ?
       where prompt = ?`,
    ).run(
      new Date(now).toISOString(),
      new Date(now - 15 * 86_400_000).toISOString(),
      now,
      prompt,
    );
  } finally {
    db.close();
  }
}

test("лестница: шаблон для новых слов, обычное поле для выученных; подсказки → варианты → показ", async ({
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
  makeKnown("разочарование");

  // «разочарование» выучено → обычное поле, длину не подсказываем; потом число букв → шаблон → буква.
  await page.getByRole("link", { name: "Тренировка" }).click();
  await expect(
    page.getByRole("heading", { name: "разочарование" }),
  ).toBeVisible();
  await expect(page.getByTestId("hint-mask")).toBeHidden();
  // Пустой ответ не отправить: случайный Enter не засчитывается как «Не помню».
  await expect(page.getByRole("button", { name: "Проверить" })).toBeDisabled();
  await page.getByLabel("Ответ по-английски").press("Enter");
  await expect(page.getByText("Подсказка:")).toBeHidden();
  await page.getByLabel("Ответ по-английски").fill("frustr");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByTestId("length-hint")).toHaveText("11 букв");
  // Неверная попытка на числе букв — дальше шаблон.
  await page.getByLabel("Ответ по-английски").fill("frust");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Не то — вот шаблон слова:")).toBeVisible();
  const mask = page.getByTestId("hint-mask");
  const cells = mask.getByRole("textbox");
  await expect(cells).toHaveCount(11);
  await page.getByRole("button", { name: "Ещё буква" }).click();
  await expect(mask.locator("[data-revealed]")).toHaveText("f");
  // Ввод с первой свободной клетки: открытая «f» пропускается.
  await page.getByLabel("Буква 2", { exact: true }).click();
  await page.keyboard.type("rustration");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Верно, с подсказкой")).toBeVisible();
  await page.getByRole("button", { name: "Дальше" }).click();

  // «кровь» — новое слово: сразу шаблон из 5 клеток, обычного поля нет.
  await expect(page.getByRole("heading", { name: "кровь" })).toBeVisible();
  await expect(page.getByText("Впиши слово по буквам:")).toBeVisible();
  await expect(cells).toHaveCount(5);
  await expect(page.getByLabel("Ответ по-английски")).toBeHidden();
  await expect(page.getByRole("button", { name: "Проверить" })).toBeDisabled();
  await page.getByRole("button", { name: "Не помню" }).click();
  await expect(page.getByText("Подсказок: 0.")).toBeVisible();
  await expect(cells).toHaveCount(5);

  // Верно вписанную «b» подсказка не трогает — открывает другую букву, красную, в неё не ввести.
  await page.getByLabel("Буква 1", { exact: true }).click();
  await page.keyboard.type("b");
  await page.getByRole("button", { name: "Ещё буква" }).click();
  await expect(page.getByText("Подсказок: 1.")).toBeVisible();
  await expect(page.getByLabel("Буква 1", { exact: true })).toHaveValue("b");
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
  await expect(page.getByLabel("Буква 1", { exact: true })).toHaveValue("b");

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

  // «вода» — новое слово, в шаблоне с ошибкой: после неё тот же шаблон, вписанное на месте.
  await expect(page.getByRole("heading", { name: "вода" })).toBeVisible();
  await page.getByLabel("Буква 1", { exact: true }).click();
  await page.keyboard.type("wxyzq");
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Не то. Исправь буквы или возьми подсказку:"),
  ).toBeVisible();
  await expect(page.getByLabel("Буква 1", { exact: true })).toHaveValue("w");
  await page.getByLabel("Буква 2", { exact: true }).click();
  await page.keyboard.type("ater");
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

test("новое слово, верно в шаблоне — «Верно!»", async ({ page }) => {
  await page.goto("/words");
  await page.getByRole("tab", { name: "Вручную" }).click();
  await addManual(page, "присматривать", "to look after");
  const { words } = await (await page.request.get("/api/words")).json();
  const id = words.find(
    (w: { prompt: string }) => w.prompt === "присматривать",
  ).id;
  await page.goto(`/?word=${id}`);
  // Шаблон без «to»: 4 + 5 клеток.
  await expect(page.getByTestId("hint-mask").getByRole("textbox")).toHaveCount(
    9,
  );
  await page.getByLabel("Буква 1", { exact: true }).click();
  await page.keyboard.type("look after");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
});
