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

## Выкатка

Прод — VM apps-tokyo (AWS Lightsail, общая с binance-dashboard): https://words.13.114.11.53.sslip.io.

- Код: `/srv/words/app` (пакет из `scripts/deploy.sh`: `dist/`, `drizzle/`, `data/dictionary.json` и только `better-sqlite3` в `node_modules`).
- База: `/var/lib/words/app.db`; ночная копия `words-backup.timer` (23:30 UTC) → `/var/lib/words/backups`.
- Секреты: `/etc/words/app.env` (root:words 640) — Google OAuth, VAPID, `SITE_URL`, `ALLOWED_EMAILS`, `DATABASE_PATH`. Копия у владельца — `~/.config/word-drill/app.env`.
- Сервис `words.service` (порт 5010, MemoryMax 200M), сайт в Caddy — `scripts/server/add-project.sh words --port 5010 --exec dist/server.mjs --memory 200M --heap 96` и `add-backup.sh words` из binance-dashboard (один раз).
- Выкатка: GitHub Actions `Deploy` после зелёного CI на `main` (или вручную с ветки). С Mac: `VM_HOST=13.114.11.53 VM_KEY=~/.ssh/apps_tokyo_deploy bash scripts/deploy.sh`.
- Вход: OAuth-клиент «Word Drill web» в Google Cloud, проект `word-drill-511911`. Приложение в тестовом режиме: войти могут только тестовые пользователи (Google Auth Platform → Audience → Test users, до 100) **и** почты из `ALLOWED_EMAILS` — новых людей добавлять в оба списка.

## Структура

- `src/` — клиент по Feature-Sliced Design: `app → pages → widgets → features → entities → shared`.
  - `shared/lib/answer-check` — проверка ответа (опечатки, соседние клавиши, британское написание).
  - `shared/lib/srs` — лестница, оценка FSRS, скорость, «знание».
  - `shared/lib/hints` — подсказки по буквам.
- `server/` — Hono API (`app.ts`), вход (`auth/`), БД (`db/`), тренировка (`drill/`), словарь (`dictionary/`).
- `scripts/` — `dev.ts`, импорт словаря.
- `e2e/` — Playwright.
