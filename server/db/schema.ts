import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { SpeedSample } from "../../src/shared/lib/srs/index.ts";
import type { AccessStatus } from "../auth/access.ts";
import type {
  Attempt,
  Direction,
  StoredCard,
  WordSource,
} from "../drill/types.ts";
import type { UserSettings } from "../users.ts";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  settings: text("settings", { mode: "json" }).$type<UserSettings>().notNull(),
  /** История скорости ввода (srs/speed): по ней оценивается «быстро/медленно». */
  speedHistory: text("speed_history", { mode: "json" })
    .$type<SpeedSample[]>()
    .notNull(),
  /** Версия приложения, которое последним обращалось к серверу (заголовок X-App-Version). */
  appVersion: text("app_version"),
  /** О какой версии уже прислали уведомление «Word Drill обновился». */
  updateNotifiedVersion: text("update_notified_version"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 токена из cookie. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

/**
 * Кто может входить (кроме ALLOWED_EMAILS — админов): заявки и решения админа.
 * pending — заявка ждёт решения; approved — пускать; denied — не пускать.
 */
export const access = sqliteTable("access", {
  email: text("email").primaryKey(),
  status: text("status").$type<AccessStatus>().notNull(),
  name: text("name").notNull().default(""),
  requestedAt: integer("requested_at", { mode: "timestamp_ms" }),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
});

/** Личные токены для «Команд» iOS и других скриптов (Authorization: Bearer). В базе — только хэш. */
export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hash: text("hash").notNull().unique(),
    /** Первые символы токена — чтобы отличать токены в списке. */
    prefix: text("prefix").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("api_tokens_user").on(t.userId)],
);

/** «Входящие»: текст со скриншота или из «Поделиться» — из него предлагаются слова. */
export const inbox = sqliteTable(
  "inbox",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("inbox_user").on(t.userId, t.createdAt)],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("push_subscriptions_user").on(t.userId)],
);

/** Отправленные уведомления: по ним считаются пауза, дневной лимит и пуши без ответа. */
export const pushLog = sqliteTable(
  "push_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: integer("word_id").references(() => words.id, {
      onDelete: "set null",
    }),
    isNew: integer("is_new", { mode: "boolean" }).notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
    /** Когда пользователь ответил (любой шаг тренировки после пуша). */
    answeredAt: integer("answered_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("push_log_user_sent").on(t.userId, t.sentAt)],
);

export const words = sqliteTable(
  "words",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Что показываем: русское слово. */
    prompt: text("prompt").notNull(),
    /** Допустимые английские ответы; первый — основной. */
    answers: text("answers", { mode: "json" }).$type<string[]>().notNull(),
    source: text("source").$type<WordSource>().notNull(),
    /** Карточка FSRS (даты в ISO). */
    card: text("card", { mode: "json" }).$type<StoredCard>().notNull(),
    /** Копия card.due для выборки «что пора повторить». */
    due: integer("due", { mode: "timestamp_ms" }).notNull(),
    lastGrade: integer("last_grade"),
    /** Незаконченный показ: лестница прошла ввод, но ещё не дошла до конца. */
    attempt: text("attempt", { mode: "json" }).$type<Attempt>(),
    // Обратное направление (английское → пишешь по-русски): свой прогресс FSRS.
    // Null — ещё не начато: открывается, когда прямое знание дошло до TEMPLATE_UNTIL.
    revCard: text("rev_card", { mode: "json" }).$type<StoredCard>(),
    revDue: integer("rev_due", { mode: "timestamp_ms" }),
    revLastGrade: integer("rev_last_grade"),
    revAttempt: text("rev_attempt", { mode: "json" }).$type<Attempt>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("words_user_due").on(t.userId, t.due),
    uniqueIndex("words_user_prompt").on(t.userId, t.prompt),
  ],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => words.id, { onDelete: "cascade" }),
    at: integer("at", { mode: "timestamp_ms" }).notNull(),
    /** Первый шаг показа (ввод: вердикт) — по нему ставится оценка. */
    first: text("first", { mode: "json" }).notNull(),
    /** Самый нижний шаг лестницы, до которого дошли. */
    deepest: text("deepest").notNull(),
    /** Сколько букв открыто подсказками. */
    hints: integer("hints").notNull().default(0),
    grade: integer("grade").notNull(),
    elapsedMs: integer("elapsed_ms"),
    /** ru-en — русское → английское, en-ru — обратно. */
    direction: text("direction").$type<Direction>().notNull().default("ru-en"),
  },
  (t) => [index("reviews_user_at").on(t.userId, t.at)],
);

/** Журнал событий приложения и сервера для разбора проблем на устройствах (server/log). Хранится 14 дней. */
export const clientLogs = sqliteTable(
  "client_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Null — запрос без входа (например, скачивание файла команды из Safari). */
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    at: integer("at", { mode: "timestamp_ms" }).notNull(),
    /** Кто записал: client — приложение, server — сервер. */
    source: text("source").$type<"client" | "server">().notNull(),
    event: text("event").notNull(),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
    appVersion: text("app_version"),
    userAgent: text("user_agent"),
  },
  (t) => [index("client_logs_at").on(t.at)],
);
