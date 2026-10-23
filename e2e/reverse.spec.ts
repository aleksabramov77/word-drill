import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";

// База e2e-сервера (playwright.config.ts → DATABASE_PATH).
const DB_PATH = "test-results/e2e.db";

/** Знание ~70%, повтор не скоро, прошлый ответ давно — обратное направление открыто. */
function makeKnownNotDue(prompt: string) {
  const db = new Database(DB_PATH);
  try {
    const now = Date.now();
    const due = now + 5 * 86_400_000;
    db.prepare(
      `update words set
         card = json_set(card, '$.state', 2, '$.stability', 15, '$.difficulty', 5, '$.reps', 5,
                         '$.due', ?, '$.last_review', ?),
         due = ?
       where prompt = ?`,
    ).run(
      new Date(due).toISOString(),
      new Date(now - 15 * 86_400_000).toISOString(),
      due,
      prompt,
    );
  } finally {
    db.close();
  }
}

test("обратное направление: английское слово → ответ по-русски, свой прогресс в списке", async ({
  page,
}) => {
  await page.goto("/words");
  await page.getByRole("tab", { name: "Вручную" }).click();
  await page.getByLabel("По-русски").fill("ущелье");
  await page.getByLabel("По-английски").fill("gorge");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByText("Добавлено: ущелье")).toBeVisible();
  makeKnownNotDue("ущелье");
  const { words } = await (await page.request.get("/api/words")).json();
  const id = words.find((w: { prompt: string }) => w.prompt === "ущелье").id;

  await page.goto(`/?word=${id}&dir=en-ru`);
  await expect(page.getByRole("heading", { name: "gorge" })).toBeVisible();
  await expect(page.getByText("новое: как по-русски")).toBeVisible();
  // Новое обратное направление — сразу шаблон по числу русских букв.
  await expect(page.getByLabel("Буква 6", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Буква 7", { exact: true })).toBeHidden();
  await expect(page.getByLabel("Буква 1", { exact: true })).toHaveAttribute(
    "lang",
    "ru",
  );

  // Слово прилипает к верху, когда карточку прокручивают.
  await page.setViewportSize({ width: 390, height: 300 });
  await page.mouse.wheel(0, 400);
  await expect
    .poll(async () => {
      const box = await page
        .getByRole("heading", { name: "gorge" })
        .boundingBox();
      return box ? Math.round(box.y) : -1;
    })
    .toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByLabel("Буква 1", { exact: true }).click();
  await page.keyboard.type("ущелье");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Верно!", { exact: true })).toBeVisible();

  await page.goto("/words");
  const reverse = page
    .getByRole("listitem")
    .filter({ hasText: "ущелье" })
    .getByTestId("reverse-status");
  await expect(reverse).toContainText("en → ru");
  await expect(reverse).toContainText("знание");
});
