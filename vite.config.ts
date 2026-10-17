import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// В dev Vite отдаёт клиент, а /api проксирует на Hono (scripts/dev.ts задаёт API_PORT).
// В проде клиент собирается в dist/client, и его раздаёт сам Hono (server/main.ts).
const apiPort = process.env.API_PORT ?? "5100";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${apiPort}` },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  test: {
    include: [
      "src/**/*.test.{ts,tsx}",
      "server/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
  },
});
