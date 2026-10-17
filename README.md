# Word Drill

Тренажёр трудных английских слов: приложение присылает слова, подбирает интервалы повторения (FSRS) по точности и скорости ответа и гоняет трудное слово по лестнице «ввести → вспомнить по подсказкам-буквам → выбрать из вариантов → переписать», пока оно не выучится.

Веб-приложение (PWA): Vite + React на клиенте, Hono + SQLite на сервере, один Node-процесс.

## Запуск

```bash
pnpm install
pnpm dev        # сайт на первом свободном порту от 5000, API — от 5100
pnpm check      # Biome, Steiger (FSD), tsc, Vitest
pnpm test:e2e   # Playwright на прод-сборке с временной БД
pnpm build      # dist/client (SPA) + dist/server.mjs
pnpm start      # прод-сервер: API и SPA на $PORT
pnpm dict:import  # словарь курса Duolingo ru→en с duome.eu → data/dictionary.json
pnpm db:generate  # миграция SQLite после правки server/db/schema.ts
```

Переменные окружения — в `.env.example` (локально копия в `.env.local`).

## Вход

- Без `GOOGLE_CLIENT_ID` локально работает один пользователь без входа (dev-режим). В проде сервер без Google не запускается.
- С Google: пускаются только подтверждённые почты из `ALLOWED_EMAILS`. У каждого пользователя свои слова и прогресс.
- Сессия — cookie `wd_session` (httpOnly, 90 дней); в базе хранится только SHA-256 токена.

## Уведомления

- Web Push с ключами VAPID (`pnpm vapid`); без ключей выключены.
- Планировщик раз в минуту (`server/push/decide.ts`, детерминированно, без нейросетей): окно часов по часовому поясу пользователя, пауза между уведомлениями (удваивается, пока они без ответа, до 4 часов), дневной лимит, не больше N новых слов в день. Слово — первое из очереди тренировки.
- Нажатие на уведомление открывает `/?word=<id>` — карточку этого слова.
- На iPhone уведомления работают только у сайта, добавленного на экран «Домой» (iOS 16.4+).
- Иконки: `pnpm pwa:icons` из `public/icon.svg`.

## Структура

- `src/` — клиент по Feature-Sliced Design: `app → pages → widgets → features → entities → shared`.
  - `shared/lib/answer-check` — проверка ответа (опечатки, соседние клавиши, британское написание).
  - `shared/lib/srs` — лестница, оценка FSRS, скорость, «знание».
  - `shared/lib/hints` — подсказки по буквам.
- `server/` — Hono API (`app.ts`), вход (`auth/`), БД (`db/`), тренировка (`drill/`), словарь (`dictionary/`).
- `scripts/` — `dev.ts`, импорт словаря.
- `e2e/` — Playwright.
