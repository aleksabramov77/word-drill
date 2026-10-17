import { expect, test } from "@playwright/test";

test("входящие: текст скриншота → подсказка пары → добавить; токен для «Команд»", async ({
  page,
}) => {
  await page.goto("/words?tab=inbox");
  await page
    .getByLabel("Текст для разбора")
    .fill("09:41\nПереведите\nмолоко\nmilk\nПРОДОЛЖИТЬ");
  await page.getByRole("button", { name: "Разобрать" }).click();

  // Пара найдена: русская форма со скриншота уже выбрана для вопроса.
  const suggestion = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Добавить milk" }) });
  await expect(
    suggestion.getByRole("button", { name: "молоко" }),
  ).toBeVisible();
  await suggestion.getByRole("button", { name: "Добавить milk" }).click();
  await expect(page.getByText("Добавлено: молоко — milk")).toBeVisible();
  await expect(
    page.getByText("молоко — milk", { exact: false }).last(),
  ).toBeVisible();

  // Ключ: без доступа к буферу показывается один раз; новый заменяет прежний.
  await page.getByRole("link", { name: "Ещё", exact: true }).click();
  await page.getByRole("link", { name: /Команда для iPhone/ }).click();
  await page.getByRole("button", { name: "Скопировать ключ" }).click();
  await expect(page.locator("code").filter({ hasText: /^wd_/ })).toBeVisible();
  await expect(
    page.getByText(/^Ключ создан .* ещё не присылала/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Скопировать ключ" }).click();
  const { tokens } = await (await page.request.get("/api/tokens")).json();
  expect(tokens).toHaveLength(1);
  // Файл команды — в том же окне (так iPhone показывает «Open in Shortcuts»), запасной — в отдельном.
  await expect(
    page.getByRole("link", { name: "Установить команду" }),
  ).toHaveAttribute("href", "/word-drill.shortcut?via=same");
  await expect(
    page.getByRole("link", { name: "Открыть в отдельном окне" }),
  ).toHaveAttribute("target", "_blank");
  await page.getByRole("button", { name: "Отключить команду" }).click();
  await expect(page.getByText(/^Ключ создан/)).toBeHidden();
});
