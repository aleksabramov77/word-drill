// Steiger — официальный линтер Feature-Sliced Design. Запуск: `pnpm lint:fsd`.
import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // Проект растёт по этапам: пока слайсов мало, часть из них используется в одном месте.
      "fsd/insignificant-slice": "off",
    },
  },
  {
    files: ["./src/shared/**"],
    rules: {
      // Сегменты shared/lib и shared/ui отдают модули по отдельности (answer-check, srs, Button…).
      "fsd/public-api": "off",
    },
  },
]);
