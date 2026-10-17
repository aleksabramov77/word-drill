import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { SpeedSample } from "../../src/shared/lib/srs/index.ts";
import type { Attempt, StoredCard, WordSource } from "../drill/types.ts";
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
  },
  (t) => [index("reviews_user_at").on(t.userId, t.at)],
);
