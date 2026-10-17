import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  checkAnswer,
  letterCount,
  normalize,
} from "../../src/shared/lib/answer-check/index.ts";
import {
  pickDistractors,
  shuffle,
} from "../../src/shared/lib/distractors/index.ts";
import {
  type Card,
  classifySpeed,
  gradeAttempt,
  isHot,
  newCard,
  nextStage,
  pushSpeedSample,
  type ReviewGrade,
  recallProbability,
  reviewCard,
  type Speed,
  type StageResult,
  State,
  wordStatus,
} from "../../src/shared/lib/srs/index.ts";
import type { Db } from "../db/client.ts";
import { reviews, users, words } from "../db/schema.ts";
import type { Dictionary } from "../dictionary/index.ts";
import type {
  Attempt,
  DrillQueue,
  StepInput,
  StepResult,
  StoredCard,
  WordView,
} from "./types.ts";

type WordRow = typeof words.$inferSelect;

const CHOICE_COUNT = 4;

export function toStoredCard(card: Card): StoredCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  };
}

export function fromStoredCard(stored: StoredCard): Card {
  return {
    ...stored,
    due: new Date(stored.due),
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

function toView(row: WordRow, now: Date): WordView {
  const card = fromStoredCard(row.card);
  return {
    id: row.id,
    prompt: row.prompt,
    answers: row.answers,
    source: row.source,
    status: wordStatus(
      card,
      (row.lastGrade ?? undefined) as ReviewGrade | undefined,
    ),
    hot: isHot(card),
    recall: recallProbability(card, now),
    due: card.due.toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    createdAt: row.createdAt.toISOString(),
  };
}

const text = z.string().trim().min(1).max(100);

export const addWordSchema = z.object({
  prompt: text,
  answers: z.array(text).min(1).max(10),
  source: z.enum(["dictionary", "manual", "inbox"]).default("manual"),
});
export type AddWordInput = z.infer<typeof addWordSchema>;

export const updateWordSchema = z.object({
  prompt: text.optional(),
  answers: z.array(text).min(1).max(10).optional(),
});
export type UpdateWordInput = z.infer<typeof updateWordSchema>;

function uniqueAnswers(answers: readonly string[]): string[] {
  const seen = new Set<string>();
  return answers.filter((answer) => {
    const key = normalize(answer);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function userWords(db: Db, userId: string): WordRow[] {
  return db
    .select()
    .from(words)
    .where(eq(words.userId, userId))
    .orderBy(desc(words.createdAt), desc(words.id))
    .all();
}

function findWord(db: Db, userId: string, id: number): WordRow | undefined {
  return db
    .select()
    .from(words)
    .where(and(eq(words.userId, userId), eq(words.id, id)))
    .get();
}

export function listWords(db: Db, userId: string, now: Date): WordView[] {
  return userWords(db, userId).map((row) => toView(row, now));
}

export function addWord(
  db: Db,
  userId: string,
  input: AddWordInput,
  now: Date,
): WordView | "duplicate" {
  const duplicate = db
    .select({ id: words.id })
    .from(words)
    .where(and(eq(words.userId, userId), eq(words.prompt, input.prompt)))
    .get();
  if (duplicate) return "duplicate";
  const card = newCard(now);
  const row = db
    .insert(words)
    .values({
      userId,
      prompt: input.prompt,
      answers: uniqueAnswers(input.answers),
      source: input.source,
      card: toStoredCard(card),
      due: card.due,
      createdAt: now,
    })
    .returning()
    .get();
  return toView(row, now);
}

export function updateWord(
  db: Db,
  userId: string,
  id: number,
  patch: UpdateWordInput,
  now: Date,
): WordView | "duplicate" | null {
  const row = findWord(db, userId, id);
  if (!row) return null;
  if (patch.prompt && patch.prompt !== row.prompt) {
    const duplicate = db
      .select({ id: words.id })
      .from(words)
      .where(and(eq(words.userId, userId), eq(words.prompt, patch.prompt)))
      .get();
    if (duplicate) return "duplicate";
  }
  const updated = db
    .update(words)
    .set({
      prompt: patch.prompt ?? row.prompt,
      answers: patch.answers ? uniqueAnswers(patch.answers) : row.answers,
    })
    .where(eq(words.id, id))
    .returning()
    .get();
  return toView(updated, now);
}

export function deleteWord(db: Db, userId: string, id: number): boolean {
  const result = db
    .delete(words)
    .where(and(eq(words.userId, userId), eq(words.id, id)))
    .run();
  return result.changes > 0;
}

/**
 * Следующее слово для тренировки: сначала «горячие» (горячий круг) по сроку,
 * потом пора повторить — с самой низкой вероятностью вспомнить, потом новые (если includeNew).
 */
export function drillQueue(
  db: Db,
  userId: string,
  now: Date,
  { includeNew = true }: { includeNew?: boolean } = {},
): DrillQueue {
  const rows = userWords(db, userId).map((row) => ({
    row,
    card: fromStoredCard(row.card),
  }));
  const fresh = rows
    .filter(({ card }) => card.state === State.New)
    .sort((a, b) => a.row.createdAt.getTime() - b.row.createdAt.getTime());
  const started = rows.filter(({ card }) => card.state !== State.New);
  const due = started
    .filter(({ card }) => card.due.getTime() <= now.getTime())
    .map((item) => ({ ...item, recall: recallProbability(item.card, now) }))
    .sort((a, b) => {
      const hot = Number(isHot(b.card)) - Number(isHot(a.card));
      if (hot !== 0) return hot;
      if (isHot(a.card)) return a.card.due.getTime() - b.card.due.getTime();
      return a.recall - b.recall;
    });
  const later = started
    .filter(({ card }) => card.due.getTime() > now.getTime())
    .map(({ card }) => card.due.getTime());

  const pick = due[0] ?? (includeNew ? fresh[0] : undefined);
  return {
    card: pick
      ? {
          wordId: pick.row.id,
          prompt: pick.row.prompt,
          letters: letterCount(pick.row.answers[0] ?? ""),
          isNew: pick.card.state === State.New,
          hot: isHot(pick.card),
        }
      : null,
    dueCount: due.length,
    newCount: fresh.length,
    nextDue: later.length ? new Date(Math.min(...later)).toISOString() : null,
  };
}

function choiceOptions(
  db: Db,
  userId: string,
  row: WordRow,
  dictionary: Dictionary,
): string[] {
  const answer = row.answers[0] ?? "";
  const excluded = new Set(row.answers.map(normalize));
  const pool = [
    ...userWords(db, userId)
      .filter((other) => other.id !== row.id)
      .map((other) => other.answers[0] ?? ""),
    ...dictionary.words.map((word) => word.en),
  ].filter((word) => !excluded.has(normalize(word)));
  return shuffle([answer, ...pickDistractors(answer, pool, CHOICE_COUNT - 1)]);
}

function otherAnswers(db: Db, userId: string, wordId: number): string[] {
  return userWords(db, userId)
    .filter((row) => row.id !== wordId)
    .flatMap((row) => row.answers);
}

function finish(
  db: Db,
  row: WordRow,
  attempt: Attempt,
  now: Date,
): NonNullable<StepResult["outcome"]> {
  const grade = gradeAttempt(attempt.first, attempt.speed);
  const card = reviewCard(fromStoredCard(row.card), grade, now);
  db.update(words)
    .set({
      card: toStoredCard(card),
      due: card.due,
      lastGrade: grade,
      attempt: null,
    })
    .where(eq(words.id, row.id))
    .run();
  db.insert(reviews)
    .values({
      userId: row.userId,
      wordId: row.id,
      at: now,
      first: attempt.first,
      deepest: attempt.stage,
      grade,
      elapsedMs: attempt.elapsedMs,
    })
    .run();
  return {
    grade,
    status: wordStatus(card, grade),
    hot: isHot(card),
    due: card.due.toISOString(),
  };
}

/** Один шаг лестницы для слова: проверить ответ, решить, что дальше, и в конце показа обновить FSRS. */
export function answerStep(
  db: Db,
  dictionary: Dictionary,
  userId: string,
  wordId: number,
  step: StepInput,
  now: Date,
): StepResult | null {
  const row = findWord(db, userId, wordId);
  if (!row) return null;
  const expected = row.answers[0] ?? "";

  let result: StageResult;
  let attempt: Attempt;
  let checked: ReturnType<typeof checkAnswer> | undefined;

  if (step.stage === "type") {
    checked = checkAnswer(
      step.input,
      row.answers,
      otherAnswers(db, userId, wordId),
    );
    result = { stage: "type", verdict: checked.verdict };
    let speed: Speed = "normal";
    const elapsedMs = step.elapsedMs ?? null;
    if (
      elapsedMs !== null &&
      (checked.verdict === "correct" || checked.verdict === "typo")
    ) {
      const user = db.select().from(users).where(eq(users.id, userId)).get();
      const sample = { elapsedMs, letters: letterCount(checked.expected) };
      const history = user?.speedHistory ?? [];
      speed = classifySpeed(sample, history);
      db.update(users)
        .set({ speedHistory: pushSpeedSample(history, sample) })
        .where(eq(users.id, userId))
        .run();
    }
    attempt = { first: result, speed, stage: "type", elapsedMs };
  } else {
    const correct =
      step.stage === "choice"
        ? row.answers.some(
            (answer) => normalize(answer) === normalize(step.input),
          )
        : checkAnswer(step.input, row.answers).verdict === "correct";
    result = { stage: step.stage, correct };
    attempt = row.attempt
      ? { ...row.attempt, stage: step.stage }
      : { first: result, speed: "normal", stage: step.stage, elapsedMs: null };
  }

  const next = nextStage(result);
  const correct = result.stage === "type" ? next === "done" : result.correct;
  const base: StepResult = {
    ...(checked ? { verdict: checked.verdict } : {}),
    correct,
    expected: checked?.expected ?? expected,
    next,
  };
  if (next === "done")
    return { ...base, outcome: finish(db, row, attempt, now) };

  db.update(words)
    .set({ attempt: { ...attempt, stage: next } })
    .where(eq(words.id, row.id))
    .run();
  return next === "choice"
    ? { ...base, options: choiceOptions(db, userId, row, dictionary) }
    : base;
}
