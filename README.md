# Word Drill

Тренажёр трудных английских слов: приложение само присылает push-уведомления со словами, подбирает интервалы повторения (FSRS) по точности и скорости ответа и гоняет трудное слово по лестнице «ввести → выбрать из вариантов → показать», пока оно не выучится.

Веб-приложение (PWA): Vite + React на клиенте, Hono + SQLite на сервере, один Node-процесс.

## Запуск

```bash
pnpm install
pnpm dev      # сайт на первом свободном порту от 5000, API — от 5100
pnpm check    # Biome, Steiger (FSD), tsc, Vitest
pnpm build    # dist/client (SPA) + dist/server.mjs
pnpm start    # прод-сервер: API и SPA на $PORT
```

## Структура

- `src/` — клиент по Feature-Sliced Design: `app → pages → widgets → features → entities → shared`.
- `server/` — Hono API (`app.ts`) и точка входа (`main.ts`).
- `scripts/` — служебные скрипты (`dev.ts`).
