import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("«Скачать CSV» на странице слов отдаёт таблицу", async ({ page }) => {
  await page.goto("/words");
  await page.getByRole("tab", { name: "Вручную" }).click();
  await page.getByLabel("По-русски").fill("пещера");
  await page.getByLabel("По-английски").fill("cave");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText("Добавлено: пещера")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Скачать CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^word-drill-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const text = await readFile(await file.path(), "utf8");
  expect(text).toContain("пещера;cave;новое");
});
