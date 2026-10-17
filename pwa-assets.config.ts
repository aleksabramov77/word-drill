import {
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

// Иконки PWA из public/icon.svg: `pnpm pwa:icons` (результат лежит в public/ и коммитится).
export default defineConfig({
  // Без полей: фон иконки — тёмный квадрат во весь размер.
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.1,
      resizeOptions: { background: "#171717" },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: "#171717" },
    },
  },
  images: ["public/icon.svg"],
});
