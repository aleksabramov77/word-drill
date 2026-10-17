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

/** Незаконченный показ слова: первый шаг (по нему оценка) и текущий шаг лестницы. */
export interface Attempt {
  first: StageResult;
  speed: Speed;
  stage: Stage;
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
}

export interface StepResult {
  /** Только для ввода. */
  verdict?: Verdict;
  /** Шаг пройден: ввод верно или с опечаткой, выбор верный, ответ переписан. */
  correct: boolean;
  expected: string;
  next: Stage | "done";
  /** Варианты, если следующий шаг — выбор. */
  options?: string[];
  outcome?: {
    grade: ReviewGrade;
    status: WordStatus;
    hot: boolean;
    due: string;
  };
}
