import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// В dev Vite отдаёт клиент, а /api проксирует на Hono (scripts/dev.ts задаёт API_PORT).
// В проде клиент собирается в dist/client, и его раздаёт сам Hono (server/main.ts).
const apiPort = process.env.API_PORT ?? "5100";
// Время сборки — в «Настройках», чтобы было видно, что новая версия дошла до телефона.
process.env.VITE_BUILD_TIME ??= new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: свой service worker (src/app/sw.ts) — кэш сборки и обработка уведомлений.
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/app",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      manifest: {
        name: "Word Drill",
        short_name: "Word Drill",
        description: "Тренажёр трудных английских слов",
        lang: "ru",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#171717",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
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
