import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";

// База e2e-сервера (playwright.config.ts → DATABASE_PATH).
const DB_PATH = "test-results/e2e.db";

function events(): { source: string; event: string; data: string | null }[] {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    return db
      .prepare("select source, event, data from client_logs order by id")
      .all() as { source: string; event: string; data: string | null }[];
  } finally {
    db.close();
  }
}

test("журнал: запуск приложения и скачивание файла команды попадают в базу", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ещё", exact: true }).waitFor();
  await expect
    .poll(() => events().some((e) => e.event === "app-open"))
    .toBe(true);

  const file = await page.request.get("/word-drill.shortcut?via=window");
  expect(file.status()).toBe(200);
  expect(file.headers()["content-disposition"]).toMatch(/^inline;/);
  await expect
    .poll(() =>
      events().some(
        (e) =>
          e.source === "server" &&
          e.event === "shortcut-download" &&
          e.data?.includes('"via":"window"'),
      ),
    )
    .toBe(true);
});
