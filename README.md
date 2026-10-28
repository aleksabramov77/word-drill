**English** | [Русский](README.ru.md)

# Word Drill

A trainer for hard English words: the app sends you words, picks review intervals (FSRS) based on how accurately and how quickly you answer, and walks a hard word up a ladder of "type it → recall it from letter hints → pick it from options → copy it out" until it sticks.

A web app (PWA): Vite + React on the client, Hono + SQLite on the server, a single Node process.

## Running

```bash
pnpm install
pnpm dev        # site on the first free port from 5000, API from 5100
pnpm check      # Biome, Steiger (FSD), tsc, Vitest
pnpm test:e2e   # Playwright against the production build with a temporary DB
pnpm build      # dist/client (SPA) + dist/server.mjs
pnpm start      # production server: API and SPA on $PORT
pnpm dict:import  # Duolingo ru→en course dictionary from duome.eu → data/dictionary.json
pnpm db:generate  # SQLite migration after editing server/db/schema.ts
```

Environment variables are listed in `.env.example` (locally, copy it to `.env.local`).

## Sign-in

- Without `GOOGLE_CLIENT_ID`, the app runs locally for a single user with no sign-in (dev mode). In production the server refuses to start without Google.
- With Google: emails in `ALLOWED_EMAILS` are admins and can always sign in. Everyone else leaves an access request when signing in: admins get a push notification, and the request is approved or rejected on the Admin page («Админка», `/admin`, linked from Settings («Настройки»)). An email can also be let in in advance, and access can be revoked (sessions are closed immediately). Every user has their own words and progress.
- The session is the `wd_session` cookie (httpOnly, 90 days); the database stores only the SHA-256 of the token.

## Notifications

- Web Push with VAPID keys (`pnpm vapid`); without keys, notifications are off.
- A scheduler runs once a minute (`server/push/decide.ts`, deterministic, no neural networks): a window of hours in the user's time zone, a pause between notifications (doubled while they go unanswered, up to 4 hours), a daily limit, and no more than N new words per day. The word sent is the first one in the training queue.
- Tapping a notification opens `/?word=<id>`, the card for that word.
- On iPhone, notifications only work for a site added to the Home Screen (iOS 16.4+).
- Icons: `pnpm pwa:icons` from `public/icon.svg`.

## Deployment

Production is the apps-tokyo VM (AWS Lightsail, shared with binance-dashboard): https://words.13.114.11.53.sslip.io.

- Code: `/srv/words/app` (the package built by `scripts/deploy.sh`: `dist/`, `drizzle/`, `data/dictionary.json`, and only `better-sqlite3` in `node_modules`).
- Database: `/var/lib/words/app.db`; nightly backup by `words-backup.timer` (23:30 UTC) → `/var/lib/words/backups`.
- Secrets: `/etc/words/app.env` (root:words 640): Google OAuth, VAPID, `SITE_URL`, `ALLOWED_EMAILS`, `DATABASE_PATH`. The owner keeps a copy in `~/.config/word-drill/app.env`.
- The `words.service` service (port 5010, MemoryMax 200M) and the Caddy site are set up once from binance-dashboard with `scripts/server/add-project.sh words --port 5010 --exec dist/server.mjs --memory 200M --heap 96` and `add-backup.sh words`.
- Deploying: the GitHub Actions `Deploy` workflow runs after a green CI on `main` (or manually from a branch). From a Mac: `VM_HOST=13.114.11.53 VM_KEY=~/.ssh/apps_tokyo_deploy bash scripts/deploy.sh`.
- Sign-in: the "Word Drill web" OAuth client in Google Cloud, project `word-drill-511911`. While the app is in testing mode in Google, only test users reach our server (Google Auth Platform → Audience → Test users, up to 100); in production mode everyone does, and the Admin page decides who gets in.

## Structure

- `src/` — the client, built with Feature-Sliced Design: `app → pages → widgets → features → entities → shared`.
  - `shared/lib/answer-check` — answer checking (typos, adjacent keys, British spelling).
  - `shared/lib/srs` — the ladder, FSRS grading, speed, "knowledge".
  - `shared/lib/hints` — letter hints.
- `server/` — Hono API (`app.ts`), sign-in (`auth/`), DB (`db/`), training (`drill/`), dictionary (`dictionary/`).
- `scripts/` — `dev.ts`, dictionary import.
- `e2e/` — Playwright.
