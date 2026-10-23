import { expect, test } from "@playwright/test";

test("слово вне курса — из Викисловаря: по форме слова, выбор переводов, добавление", async ({
  page,
}) => {
  await page.goto("/words");
  await page.getByLabel("Поиск в словаре").fill("наковальни");

  await expect(
    page.getByRole("heading", { name: "Из Викисловаря" }),
  ).toBeVisible();
  await expect(page.getByText("нашлось по «наковальни»")).toBeVisible();
  const anvil = page.getByRole("button", { name: "anvil", exact: true });
  const incus = page.getByRole("button", { name: "incus", exact: true });
  await expect(anvil).toHaveAttribute("aria-pressed", "true");
  await expect(incus).toHaveAttribute("aria-pressed", "false");
  await incus.click();
  await expect(incus).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Добавить наковальня" }).click();
  await expect(
    page.getByText("Добавлено: наковальня — anvil, incus"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Убрать наковальня" }),
  ).toBeVisible();

  const { words } = await (await page.request.get("/api/words")).json();
  expect(
    words.find((w: { prompt: string }) => w.prompt === "наковальня").answers,
  ).toEqual(["anvil", "incus"]);
});

test("слово из курса во второй раз из Викисловаря не показывается", async ({
  page,
}) => {
  await page.goto("/words");
  await page.getByLabel("Поиск в словаре").fill("кофе");
  await expect(
    page.getByRole("button", { name: "Добавить coffee", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Добавить кофе", exact: true }),
  ).toHaveCount(0);
});
