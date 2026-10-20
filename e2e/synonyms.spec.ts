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

  // Новое слово — сразу шаблон «by far» (2 + 3); «a lot» ложится в клетки как «a» + «lot».
  await page.getByLabel("Буква 1", { exact: true }).click();
  await page.keyboard.type("a lot");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(
    page.getByText("«a lot» — тоже верно! Но здесь загадано другое слово:"),
  ).toBeVisible();
  await expect(page.getByText("Подсказок: 0.")).toBeVisible();

  // Шаблон фразы — два слова; пробел переводит курсор к следующему слову.
  const mask = page.getByTestId("hint-mask");
  await expect(mask.getByRole("textbox")).toHaveCount(5);
  await page.getByLabel("Буква 1", { exact: true }).click();
  await page.keyboard.type("b f");
  await expect(page.getByLabel("Буква 4", { exact: true })).toHaveValue("f");
  await page.getByLabel("Буква 2", { exact: true }).click();
  await page.keyboard.type("y");
  await page.getByLabel("Буква 5", { exact: true }).click();
  await page.keyboard.type("ar");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByText("Верно, с подсказкой")).toBeVisible();
});
