// Локальный запуск: Hono API и Vite на первых свободных портах.
// Сайт — от 5000 (на macOS 5000 обычно занят AirPlay Receiver — тогда 5001, 5002…), API — от 5100.
import { type ChildProcess, spawn } from "node:child_process";
import { findFreePort } from "./lib/freePort.ts";

async function main() {
  const webPort = await findFreePort(Number(process.env.PORT ?? 5000));
  const apiPort = await findFreePort(Number(process.env.API_PORT ?? 5100));
  const env = { ...process.env, API_PORT: String(apiPort) };

  const children: ChildProcess[] = [
    spawn("tsx", ["watch", "server/main.ts"], {
      stdio: "inherit",
      env: { ...env, PORT: String(apiPort) },
    }),
    spawn("vite", ["--port", String(webPort)], { stdio: "inherit", env }),
  ];
  const stop = (code: number) => {
    for (const child of children) child.kill();
    process.exit(code);
  };
  for (const child of children) child.on("exit", (code) => stop(code ?? 0));
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
