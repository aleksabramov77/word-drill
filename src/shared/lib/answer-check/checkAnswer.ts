import { typoDistance } from "./distance.ts";
import { canonicalSpelling, normalize, stripOptional } from "./normalize.ts";

/**
 * - `correct` — верно (с точностью до регистра, артикля, `to`, британского написания);
 * - `typo` — знаешь, но с ошибкой: ошибок не больше, чем допускает длина слова;
 * - `partial` — слово узнаётся, но ошибок много (до ~40% букв);
 * - `synonym` — тоже верный перевод (по словарю), но загадано другое слово;
 * - `other-word` — введён перевод другого слова из списка;
 * - `wrong` — не знаешь.
 */
export type Verdict =
  | "correct"
  | "typo"
  | "partial"
  | "synonym"
  | "other-word"
  | "wrong";

export interface CheckResult {
  verdict: Verdict;
  /** Ближайший к ответу допустимый вариант — его показываем как правильный. */
  expected: string;
  distance: number;
}

const PARTIAL_SHARE = 0.4;

/** Сколько ошибок прощается слову такой длины (замена на соседнюю клавишу — пол-ошибки). */
export function allowedTypos(letters: number): number {
  if (letters <= 2) return 0;
  if (letters <= 4) return 0.5;
  if (letters <= 8) return 1;
  return 2;
}

function forms(text: string): readonly [string, string] {
  const full = canonicalSpelling(normalize(text));
  return [full, stripOptional(full)];
}

/** Число букв ответа без артикля, `to` и пробелов — для подсказки длины и оценки скорости. */
export function letterCount(text: string): number {
  return stripOptional(normalize(text)).replaceAll(" ", "").length;
}

function answerDistance(input: string, answer: string): number {
  const [inputFull, inputShort] = forms(input);
  const [answerFull, answerShort] = forms(answer);
  return Math.min(
    typoDistance(inputFull, answerFull),
    typoDistance(inputShort, answerShort),
  );
}

export function checkAnswer(
  input: string,
  accepted: readonly string[],
  otherAnswers: readonly string[] = [],
  /** Другие переводы тех же русских слов: такой ответ не ошибка, но загадано другое. */
  synonyms: readonly string[] = [],
): CheckResult {
  const [first] = accepted;
  if (first === undefined) throw new Error("нет ни одного правильного ответа");
  if (normalize(input) === "") {
    return {
      verdict: "wrong",
      expected: first,
      distance: Number.POSITIVE_INFINITY,
    };
  }

  let expected = first;
  let distance = Number.POSITIVE_INFINITY;
  for (const answer of accepted) {
    const d = answerDistance(input, answer);
    if (d < distance) {
      expected = answer;
      distance = d;
    }
  }

  const letters = letterCount(expected);
  if (distance === 0) return { verdict: "correct", expected, distance };
  if (distance <= allowedTypos(letters)) {
    return { verdict: "typo", expected, distance };
  }
  if (synonyms.some((other) => answerDistance(input, other) === 0)) {
    return { verdict: "synonym", expected, distance };
  }
  if (otherAnswers.some((other) => answerDistance(input, other) === 0)) {
    return { verdict: "other-word", expected, distance };
  }
  if (distance <= Math.max(1, letters * PARTIAL_SHARE)) {
    return { verdict: "partial", expected, distance };
  }
  return { verdict: "wrong", expected, distance };
}
