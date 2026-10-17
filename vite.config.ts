import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

// В dev Vite отдаёт клиент, а /api проксирует на Hono (scripts/dev.ts задаёт API_PORT).
// В проде клиент собирается в dist/client, и его раздаёт сам Hono (server/main.ts).
const apiPort = process.env.API_PORT ?? "5100";
// Номер версии (package.json) и время сборки — внизу «Ещё», чтобы было видно, какая версия загружена.
process.env.VITE_APP_VERSION ??= pkg.version;
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
      registerType: "prompt",
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
        // Android: установленное приложение появляется в «Поделиться» — текст уходит во «Входящие» (src/pages/share).
        share_target: {
          action: "/share",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
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
