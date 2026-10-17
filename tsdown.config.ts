import { defineConfig } from "tsdown";

// Сервер собирается в один файл dist/server.mjs; зависимости из package.json остаются внешними.
export default defineConfig({
  entry: { server: "server/main.ts" },
  outDir: "dist",
  format: "esm",
  platform: "node",
  clean: false,
});
