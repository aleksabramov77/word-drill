import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  type CheckResult,
  checkAnswer,
  letterCount,
  normalize,
} from "../../src/shared/lib/answer-check/index.ts";
import {
  pickDistractors,
  shuffle,
} from "../../src/shared/lib/distractors/index.ts";
import {
  hintLetters,
  knownLetters,
  maskAnswer,
  nextHintIndex,
  templateBase,
  wrongCells,
} from "../../src/shared/lib/hints/index.ts";
import {
  type Card,
  classifySpeed,
  deeperStage,
  gradeAttempt,
  isHot,
  knowledge,
  newCard,
  nextStage,
  pushSpeedSample,
  type ReviewGrade,
  recallProbability,
  reviewCard,
  type Speed,
  type StageResult,
  State,
  TEMPLATE_UNTIL,
  wordStatus,
} from "../../src/shared/lib/srs/index.ts";
import type { Db } from "../db/client.ts";
import { reviews, users, words } from "../db/schema.ts";
import {
  type Dictionary,
  otherForms,
  synonymsOf,
} from "../dictionary/index.ts";
import type {
  Attempt,
  Direction,
  DrillQueue,
  HintLevel,
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
  const rev = row.revCard ? fromStoredCard(row.revCard) : null;
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
    knowledge: knowledge(card),
    due: card.due.toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    reverse: rev
      ? {
          status: wordStatus(
            rev,
            (row.revLastGrade ?? undefined) as ReviewGrade | undefined,
          ),
          hot: isHot(rev),
          knowledge: knowledge(rev),
          due: rev.due.toISOString(),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Знание прямого направления, после которого открывается обратное. */
export const REVERSE_FROM = TEMPLATE_UNTIL;
/** Обратное не спрашиваем сразу после прямого: ответ ещё перед глазами. */
const REVERSE_PAUSE_MS = 60 * 60_000;

/** Слово в одном направлении: что спрашиваем, какие ответы принимаем и чья карточка FSRS. */
interface Facing {
  row: WordRow;
  direction: Direction;
  prompt: string;
  /** Допустимые ответы; первый — основной. */
  answers: string[];
  card: Card;
  attempt: Attempt | null;
}

function facing(
  row: WordRow,
  direction: Direction,
  now: Date,
  dictionary?: Dictionary,
): Facing {
  if (direction === "ru-en") {
    return {
      row,
      direction,
      prompt: row.prompt,
      answers: row.answers,
      card: fromStoredCard(row.card),
      attempt: row.attempt,
    };
  }
  // Обратно: английское слово, ответ — любая русская форма (своя и из словаря курса).
  const en = row.answers[0] ?? "";
  return {
    row,
    direction,
    prompt: en,
    answers: uniqueAnswers([
      row.prompt,
      ...(dictionary ? otherForms(dictionary, en, row.prompt) : []),
    ]),
    card: row.revCard ? fromStoredCard(row.revCard) : newCard(now),
    attempt: row.revAttempt,
  };
}

/** Обратное направление уже начато или прямое выучено наполовину (и не только что отвечено). */
function reverseOpen(row: WordRow, now: Date): boolean {
  if (row.revCard) return true;
  const card = fromStoredCard(row.card);
  const since = card.last_review
    ? now.getTime() - card.last_review.getTime()
    : Number.POSITIVE_INFINITY;
  return knowledge(card) >= REVERSE_FROM && since >= REVERSE_PAUSE_MS;
}

/** Записать карточку, оценку и незаконченный показ своего направления. */
function saveSide(
  db: Db,
  f: Facing,
  patch: { card?: Card; lastGrade?: number; attempt: Attempt | null },
) {
  const card = patch.card ?? f.card;
  if (f.direction === "ru-en") {
    db.update(words)
      .set({
        ...(patch.card ? { card: toStoredCard(card), due: card.due } : {}),
        ...(patch.lastGrade !== undefined
          ? { lastGrade: patch.lastGrade }
          : {}),
        attempt: patch.attempt,
      })
      .where(eq(words.id, f.row.id))
      .run();
    return;
  }
  // Первый показ обратного — карточка появляется в базе, дальше направление уже открыто.
  db.update(words)
    .set({
      ...(patch.card || !f.row.revCard
        ? { revCard: toStoredCard(card), revDue: card.due }
        : {}),
      ...(patch.lastGrade !== undefined
        ? { revLastGrade: patch.lastGrade }
        : {}),
      revAttempt: patch.attempt,
    })
    .where(eq(words.id, f.row.id))
    .run();
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
  {
    includeNew = true,
    prefer,
    newAddedBefore,
    dictionary,
  }: {
    includeNew?: boolean;
    /** Слово из уведомления — показать его первым. */
    prefer?: { id: number; direction?: Direction };
    /** Новые слова — только добавленные раньше этого момента (уведомления не шлют слово, которое только что добавили). */
    newAddedBefore?: Date;
    /** Словарь — для других русских форм слова на карточке. */
    dictionary?: Dictionary;
  } = {},
): DrillQueue {
  const rows = userWords(db, userId).flatMap((row) => [
    facing(row, "ru-en", now, dictionary),
    ...(reverseOpen(row, now) ? [facing(row, "en-ru", now, dictionary)] : []),
  ]);
  // Новые: сначала обратные (слово уже знакомо), потом новые слова — по порядку добавления.
  const fresh = rows
    .filter(
      ({ row, card, direction }) =>
        card.state === State.New &&
        (direction === "en-ru" ||
          !newAddedBefore ||
          row.createdAt.getTime() <= newAddedBefore.getTime()),
    )
    .sort(
      (a, b) =>
        Number(a.direction === "ru-en") - Number(b.direction === "ru-en") ||
        a.row.createdAt.getTime() - b.row.createdAt.getTime(),
    );
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

  const preferred =
    prefer === undefined
      ? undefined
      : rows.find(
          ({ row, direction }) =>
            row.id === prefer.id && direction === (prefer.direction ?? "ru-en"),
        );
  const pick = preferred ?? due[0] ?? (includeNew ? fresh[0] : undefined);
  const base = templateBase(pick?.answers[0] ?? "");
  const template = pick ? startsInTemplate(pick.card) : false;
  return {
    card: pick
      ? {
          wordId: pick.row.id,
          direction: pick.direction,
          prompt: pick.prompt,
          alsoPrompts:
            dictionary && pick.direction === "ru-en"
              ? shuffle(
                  otherForms(
                    dictionary,
                    pick.row.answers[0] ?? "",
                    pick.row.prompt,
                  ),
                )
              : [],
          letters: letterCount(base),
          template,
          ...(template ? { mask: maskAnswer(base, []) } : {}),
          isNew: pick.card.state === State.New,
          hot: isHot(pick.card),
        }
      : null,
    dueCount: due.length,
    newCount: fresh.length,
    nextDue: later.length ? new Date(Math.min(...later)).toISOString() : null,
  };
}

/** Слово ещё не выучено — ответ вводится сразу в шаблон. */
function startsInTemplate(card: Card): boolean {
  return knowledge(card) < TEMPLATE_UNTIL;
}

function choiceOptions(
  db: Db,
  userId: string,
  f: Facing,
  dictionary: Dictionary,
): string[] {
  const answer = f.answers[0] ?? "";
  const excluded = new Set(f.answers.map(normalize));
  const others = userWords(db, userId).filter((other) => other.id !== f.row.id);
  const pool = (
    f.direction === "ru-en"
      ? [
          ...others.map((other) => other.answers[0] ?? ""),
          ...dictionary.words.map((word) => word.en),
        ]
      : [
          ...others.map((other) => other.prompt),
          ...dictionary.words.flatMap((word) => word.ru.slice(0, 1)),
        ]
  ).filter((word) => !excluded.has(normalize(word)));
  return shuffle([answer, ...pickDistractors(answer, pool, CHOICE_COUNT - 1)]);
}

/** Ответы других слов в том же направлении — чтобы узнать «это перевод другого слова». */
function otherAnswers(db: Db, userId: string, f: Facing): string[] {
  const others = userWords(db, userId).filter((row) => row.id !== f.row.id);
  return f.direction === "ru-en"
    ? others.flatMap((row) => row.answers)
    : others.map((row) => row.prompt);
}

function finish(
  db: Db,
  f: Facing,
  attempt: Attempt,
  now: Date,
): NonNullable<StepResult["outcome"]> {
  const grade = gradeAttempt(
    {
      first: attempt.first,
      deepest: attempt.deepest,
      revealed: attempt.revealed.length,
      letters: hintLetters(templateBase(f.answers[0] ?? "")),
    },
    attempt.speed,
  );
  const card = reviewCard(f.card, grade, now);
  saveSide(db, f, { card, lastGrade: grade, attempt: null });
  db.insert(reviews)
    .values({
      userId: f.row.userId,
      wordId: f.row.id,
      direction: f.direction,
      at: now,
      first: attempt.first,
      deepest: attempt.deepest,
      hints: attempt.revealed.length,
      grade,
      elapsedMs: attempt.elapsedMs,
    })
    .run();
  return {
    grade,
    status: wordStatus(card, grade),
    hot: isHot(card),
    due: card.due.toISOString(),
    knowledge: knowledge(card),
  };
}

/** Другие переводы того, что показано на карточке (главная форма и остальные по словарю). */
function cardSynonyms(dictionary: Dictionary, f: Facing): string[] {
  // Обратно все русские формы слова и так засчитываются как верные.
  if (f.direction === "en-ru") return [];
  const { row } = f;
  const forms = [
    row.prompt,
    ...otherForms(dictionary, row.answers[0] ?? "", row.prompt),
  ];
  return synonymsOf(dictionary, forms, row.answers);
}

function typeStep(
  db: Db,
  dictionary: Dictionary,
  userId: string,
  f: Facing,
  step: StepInput,
): { result: StageResult; attempt: Attempt; checked: CheckResult } {
  const checked = checkAnswer(
    step.input,
    f.answers,
    otherAnswers(db, userId, f),
    cardSynonyms(dictionary, f),
  );
  const result: StageResult = {
    stage: "type",
    verdict: checked.verdict,
    // Пустой ответ — кнопка «Не помню».
    ...(normalize(step.input) === "" ? { forgot: true } : {}),
    ...(startsInTemplate(f.card) ? { template: true } : {}),
  };
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
  return {
    result,
    attempt: {
      first: result,
      speed,
      stage: "type",
      deepest: "type",
      revealed: [],
      elapsedMs,
    },
    checked,
  };
}

/**
 * Шаг подсказок: подсказать больше, перейти к вариантам или проверить ответ.
 * Подсказки по нарастающей: число букв → шаблон → по одной букве. Неверная попытка тоже подсказывает больше.
 */
function hintStep(
  dictionary: Dictionary,
  f: Facing,
  step: StepInput,
  attempt: Attempt,
): {
  result: StageResult;
  revealed: number[];
  hintLevel: HintLevel;
  checked?: CheckResult;
  wrong?: number[];
} {
  const answer = templateBase(f.answers[0] ?? "");
  const revealed = [...attempt.revealed];
  let hintLevel: HintLevel = attempt.hintLevel ?? 2;
  /** Подсказать больше: сначала шаблон, потом буква. false — подсказывать больше нечего. */
  const more = () => {
    if (hintLevel < 2) {
      hintLevel = 2;
      return true;
    }
    const index = nextHintIndex(
      answer,
      revealed,
      Math.random,
      knownLetters(answer, step.cells ?? []),
    );
    if (index !== null) revealed.push(index);
    return index !== null;
  };

  if (step.action === "choices") {
    return {
      result: { stage: "hint", correct: false, exhausted: false, giveUp: true },
      revealed,
      hintLevel,
    };
  }
  if (step.action === "reveal") {
    return {
      result: { stage: "hint", correct: false, exhausted: !more() },
      revealed,
      hintLevel,
    };
  }
  const checked = checkAnswer(
    step.input,
    f.answers,
    [],
    cardSynonyms(dictionary, f),
  );
  const correct = checked.verdict === "correct" || checked.verdict === "typo";
  // Синоним — не ошибка: подсказка не растёт, просто «загадано другое слово».
  if (correct || checked.verdict === "synonym")
    return {
      result: { stage: "hint", correct, exhausted: false },
      revealed,
      hintLevel,
      checked,
    };
  // Шаблон заполнен целиком — обычная ошибка: подсвечиваем неверные клетки, букву не открываем.
  const wrong =
    hintLevel === 2 ? wrongCells(answer, revealed, step.cells) : null;
  if (wrong)
    return {
      result: { stage: "hint", correct, exhausted: false },
      revealed,
      hintLevel,
      checked,
      wrong,
    };
  const gaveMore = more();
  const exhausted = !gaveMore || revealed.length * 2 > hintLetters(answer);
  return {
    result: { stage: "hint", correct, exhausted },
    revealed,
    hintLevel,
    checked,
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
  const f = facing(row, step.direction ?? "ru-en", now, dictionary);
  const answer = f.answers[0] ?? "";

  let result: StageResult;
  let attempt: Attempt;
  let checked: CheckResult | undefined;
  /** Шаблон заполнен целиком, но мимо: клетки с неверными буквами. */
  let wrong: number[] | undefined;

  if (step.stage === "type") {
    ({ result, attempt, checked } = typeStep(db, dictionary, userId, f, step));
    // Шаблон сразу, если слово вводили в шаблон или ввели другой верный перевод (смысл понятен — найти именно это слово).
    attempt.hintLevel =
      result.stage === "type" &&
      (result.template || checked.verdict === "synonym")
        ? 2
        : 1;
    if (
      result.stage === "type" &&
      result.template &&
      checked.verdict !== "synonym"
    ) {
      wrong = wrongCells(templateBase(answer), [], step.cells) ?? undefined;
    }
  } else {
    // Шаги ниже ввода продолжают начатый показ; без него (страница открыта заново) — считаем, что ввод не удался.
    const current: Attempt = f.attempt ?? {
      first: { stage: "type", verdict: "wrong" },
      speed: "normal",
      stage: step.stage,
      deepest: step.stage,
      revealed: [],
      elapsedMs: null,
    };
    let revealed = current.revealed;
    let hintLevel = current.hintLevel;
    if (step.stage === "hint") {
      ({ result, revealed, hintLevel, checked, wrong } = hintStep(
        dictionary,
        f,
        step,
        current,
      ));
    } else {
      const correct =
        step.stage === "choice"
          ? f.answers.some((a) => normalize(a) === normalize(step.input))
          : checkAnswer(step.input, f.answers).verdict === "correct";
      result = { stage: step.stage, correct };
    }
    attempt = {
      ...current,
      revealed,
      ...(hintLevel ? { hintLevel } : {}),
      deepest: deeperStage(current.deepest, step.stage),
    };
  }

  const next = nextStage(result);
  const correct = result.stage === "type" ? next === "done" : result.correct;
  const base: StepResult = {
    ...(checked ? { verdict: checked.verdict } : {}),
    correct,
    expected: checked?.expected ?? answer,
    next,
  };
  if (next === "done") {
    return { ...base, outcome: finish(db, f, attempt, now) };
  }

  attempt = {
    ...attempt,
    stage: next,
    deepest: deeperStage(attempt.deepest, next),
  };
  saveSide(db, f, { attempt });
  if (next === "hint") {
    return {
      ...base,
      mask: maskAnswer(templateBase(answer), attempt.revealed),
      revealed: attempt.revealed.length,
      hintLevel: attempt.hintLevel ?? 2,
      ...(wrong?.length ? { wrong } : {}),
    };
  }
  if (next === "choice") {
    return { ...base, options: choiceOptions(db, userId, f, dictionary) };
  }
  return base;
}
