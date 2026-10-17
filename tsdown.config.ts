import { defineConfig } from "tsdown";

// Сервер собирается в один файл dist/server.mjs со всеми зависимостями внутри — кроме better-sqlite3:
// у него нативный модуль, на VM он ставится отдельно (scripts/deploy.sh). Так на VM не нужен node_modules проекта.
export default defineConfig({
  entry: { server: "server/main.ts" },
  outDir: "dist",
  format: "esm",
  platform: "node",
  target: "node22",
  clean: false,
  shims: true,
  deps: {
    neverBundle: ["better-sqlite3"],
    alwaysBundle: [/^(?!better-sqlite3)/],
    onlyBundle: false,
  },
});
