import { expect, test } from "@playwright/test";

test("пробел в шаблоне не перескакивает через слово", async ({ page }) => {
  await page.goto("/words");
  await page.getByRole("tab", { name: "Вручную" }).click();
  await page.getByLabel("По-русски").fill("заботиться");
  await page.getByLabel("По-английски").fill("to take care of");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText("Добавлено: заботиться")).toBeVisible();
  const { words } = await (await page.request.get("/api/words")).json();
  const id = words.find(
    (w: { prompt: string }) => w.prompt === "заботиться",
  ).id;
  await page.goto(`/?word=${id}`);

  // take·care·of: после «take» курсор уже в «care», пробел ничего не делает.
  await expect(page.getByLabel("Буква 1", { exact: true })).toBeFocused();
  await page.keyboard.type("take ");
  await expect(page.getByLabel("Буква 6", { exact: true })).toBeFocused();
  await page.keyboard.type("care of");
  await expect(page.getByLabel("Буква 11", { exact: true })).toHaveValue("o");
  await expect(page.getByLabel("Буква 12", { exact: true })).toHaveValue("f");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();
});

test("кнопки A− / A+ меняют размер шрифта и он сохраняется", async ({
  page,
}) => {
  await page.goto("/words");
  const rootSize = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await expect.poll(rootSize).toBe("16px");
  await page.getByRole("button", { name: "Шрифт больше" }).click();
  await page.getByRole("button", { name: "Шрифт больше" }).click();
  await expect.poll(rootSize).toBe("19.2px");
  await expect(page.getByText("120%")).toBeVisible();
  await page.reload();
  await expect.poll(rootSize).toBe("19.2px");
  await page.getByRole("button", { name: "Шрифт меньше" }).click();
  await expect.poll(rootSize).toBe("17.6px");
});

test("«Что нового» — история по версиям", async ({ page }) => {
  await page.goto("/more/whats-new");
  await expect(page.getByRole("heading", { name: /^1\.9\.0/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^1\.0\.0/ })).toBeVisible();
  await expect(
    page.getByText(/Пробел в шаблоне больше не перескакивает/),
  ).toBeVisible();
});
