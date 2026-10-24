import { expect, test } from "@playwright/test";

// Диктовка (микрофон на клавиатуре iPhone/Android, диктовка Mac/Windows) вставляет текст целиком
// и потом исправляет его в том же поле. fill() делает то же: заменяет весь текст поля.
test("диктовка в шаблон: слово целиком раскладывается по клеткам, исправления диктовки учитываются", async ({
  page,
}) => {
  await page.goto("/words");
  await page.getByRole("tab", { name: "Вручную" }).click();
  await page.getByLabel("По-русски").fill("приглядывать");
  await page.getByLabel("По-английски").fill("to look after");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText("Добавлено: приглядывать")).toBeVisible();
  const { words } = await (await page.request.get("/api/words")).json();
  const id = words.find(
    (w: { prompt: string }) => w.prompt === "приглядывать",
  ).id;
  await page.goto(`/?word=${id}`);
  const first = page.getByLabel("Буква 1", { exact: true });
  await first.click();

  // Первый кусок, потом диктовка дописывает и исправляет — курсор не уходит из клетки.
  await first.fill("Look");
  await first.fill("Look afterwards");
  await first.fill("Look after.");
  await expect(first).toBeFocused();
  // Продиктованное разложено по клеткам: заглавная и точка не мешают, лишние буквы не остались.
  const letters = page.getByTestId("hint-mask").getByRole("textbox");
  await page.getByRole("heading", { name: "приглядывать" }).click();
  await expect(first).toHaveValue("l");
  const typed = await letters.evaluateAll((els) =>
    els.map((el) => (el as HTMLInputElement).value).join(""),
  );
  expect(typed).toBe("lookafter");

  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText(/^Верно/).first()).toBeVisible();
  // База e2e общая: остальные тесты считают слова — убираем своё.
  await page.request.delete(`/api/words/${id}`);
});
