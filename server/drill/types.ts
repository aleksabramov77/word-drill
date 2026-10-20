import type { Verdict } from "../../src/shared/lib/answer-check/index.ts";
import type {
  Card,
  ReviewGrade,
  Speed,
  Stage,
  StageResult,
  WordStatus,
} from "../../src/shared/lib/srs/index.ts";

export type WordSource = "dictionary" | "manual" | "inbox";

/** Карточка FSRS в JSON: даты строками ISO. */
export type StoredCard = Omit<Card, "due" | "last_review"> & {
  due: string;
  last_review?: string;
};

/** Незаконченный показ слова. */
export interface Attempt {
  /** Результат ввода — по нему оценка, если не спускались ниже. */
  first: StageResult;
  speed: Speed;
  /** Текущий шаг лестницы. */
  stage: Stage;
  /** Самый нижний шаг, до которого дошли. */
  deepest: Stage;
  /** Открытые подсказками буквы (индексы в основном ответе). */
  revealed: number[];
  /** Уровень подсказки: 1 — только число букв, 2 — шаблон (дальше открываются буквы). Нет — шаблон. */
  hintLevel?: HintLevel;
  elapsedMs: number | null;
}

export type HintLevel = 1 | 2;

export interface WordView {
  id: number;
  prompt: string;
  answers: string[];
  source: WordSource;
  status: WordStatus;
  hot: boolean;
  /** Вероятность вспомнить сейчас, 0…1. */
  recall: number;
  /** «Знание» 0…1: прочность памяти (srs/knowledge). */
  knowledge: number;
  due: string;
  reps: number;
  lapses: number;
  createdAt: string;
}

export interface DrillCard {
  wordId: number;
  prompt: string;
  /** Другие русские формы того же слова (по словарю), в случайном порядке. */
  alsoPrompts: string[];
  /** Число букв ответа. */
  letters: number;
  /** Знание ниже порога — ответ вводится сразу в шаблон. */
  template: boolean;
  /** Пустой шаблон (null — клетка), если template. */
  mask?: (string | null)[];
  isNew: boolean;
  hot: boolean;
}

export interface DrillQueue {
  card: DrillCard | null;
  /** Сколько слов пора повторить (без новых). */
  dueCount: number;
  newCount: number;
  /** Когда следующее слово станет «пора», если сейчас нечего. */
  nextDue: string | null;
}

export interface StepInput {
  stage: Stage;
  input: string;
  elapsedMs?: number;
  /** На шаге подсказок: открыть ещё букву или перейти к вариантам. */
  action?: "reveal" | "choices";
  /** Что вписано в клетки шаблона (по индексам ответа). */
  cells?: string[];
}

export interface StepResult {
  /** Вердикт ввода (на шагах ввода и подсказок). */
  verdict?: Verdict;
  /** Шаг пройден: ввод верно или с опечаткой, выбор верный, ответ переписан. */
  correct: boolean;
  expected: string;
  next: Stage | "done";
  /** Заготовка с открытыми буквами, если следующий шаг — подсказки. */
  mask?: (string | null)[];
  /** Сколько букв открыто подсказками. */
  revealed?: number;
  /** Уровень подсказки: 1 — число букв, 2 — шаблон. */
  hintLevel?: HintLevel;
  /** Варианты, если следующий шаг — выбор. */
  options?: string[];
  outcome?: {
    grade: ReviewGrade;
    status: WordStatus;
    hot: boolean;
    due: string;
    knowledge: number;
  };
}
