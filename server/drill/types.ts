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
  elapsedMs: number | null;
}

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
  /** Число букв ответа — для подсказки длины. */
  letters: number;
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
