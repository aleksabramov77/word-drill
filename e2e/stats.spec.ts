import { expect, test } from "@playwright/test";

test("статистика: ответ сегодня виден в плитках и в столбиках", async ({
  page,
}) => {
  await page.goto("/words");
  await page.getByRole("tab", { name: "Вручную" }).click();
  await page.getByLabel("По-русски").fill("лестница");
  await page.getByLabel("По-английски").fill("ladder");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText("Добавлено: лестница")).toBeVisible();
  const { words } = await (await page.request.get("/api/words")).json();
  const id = words.find((w: { prompt: string }) => w.prompt === "лестница").id;

  const before = await (await page.request.get("/api/stats")).json();
  await page.goto(`/?word=${id}`);
  await expect(page.getByLabel("Буква 1", { exact: true })).toBeFocused();
  await page.keyboard.type("ladder");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Статистика" }).click();
  await expect(page.getByRole("heading", { name: "Статистика" })).toBeVisible();
  await expect(
    page.getByText(`сам вспомнил ${before.today.clean + 1}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("day-details")).toContainText(
    `ответов ${before.today.total + 1}`,
  );
  // Касание другого дня показывает его цифры.
  const bars = page.getByRole("button", { name: /:/ });
  await expect(bars).toHaveCount(14);
  await bars.first().click();
  await expect(page.getByTestId("day-details")).toContainText("не занимался");
});
