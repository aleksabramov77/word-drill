import { expect, test } from "@playwright/test";

test("главная форма крупно, остальные мелко; другой верный перевод — «тоже верно», заготовка без букв", async ({
  page,
}) => {
  await page.goto("/words");
  await page.getByLabel("Поиск в словаре").fill("by far");
  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Добавить by far" }) });
  // Главная форма — выбранный чипс.
  await row.getByRole("button", { name: "гораздо" }).click();
  await row.getByRole("button", { name: "Добавить by far" }).click();
  await expect(page.getByText("Добавлено: гораздо — by far")).toBeVisible();

  // Сразу это слово (база общая с другими тестами — в очереди могут быть другие).
  const { words } = await (await page.request.get("/api/words")).json();
  const id = words.find((w: { prompt: string }) => w.prompt === "гораздо").id;
  await page.goto(`/?word=${id}`);
  await expect(page.getByRole("heading", { name: "гораздо" })).toBeVisible();
  const others = page.getByText(/значительно/);
  await expect(others).toBeVisible();
  await expect(others).toContainText("намного");
  await expect(others).toContainText("далеко");

  await page.getByLabel("Ответ по-английски").fill("a lot");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(
    page.getByText("«a lot» — тоже верно! Но здесь загадано другое слово:"),
  ).toBeVisible();
  await expect(page.getByText("Подсказок: 0.")).toBeVisible();

  await page.getByLabel("Ответ по-английски").fill("by far");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Верно, с подсказкой")).toBeVisible();
});
