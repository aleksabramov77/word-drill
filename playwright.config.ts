import { defineConfig, devices } from "@playwright/test";

// e2e на прод-сборке с отдельной временной БД. Порт — от 5000 и выше (не 3000): E2E_PORT, по умолчанию 5199.
const port = Number(process.env.E2E_PORT ?? 5199);
const database = "test-results/e2e.db";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices["iPhone 15"],
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `rm -f ${database} ${database}-* && pnpm build && pnpm start`,
    env: { PORT: String(port), DATABASE_PATH: database, ALLOW_DEV_AUTH: "1" },
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
