import { describe, expect, it } from "vitest";
import {
  classifySpeed,
  DEFAULT_REACTION_MS,
  estimateReactionMs,
  gradeAttempt,
  isHot,
  median,
  newCard,
  nextStage,
  pushSpeedSample,
  Rating,
  recallProbability,
  reviewCard,
  SPEED_HISTORY_SIZE,
  type SpeedSample,
  State,
  wordStatus,
} from "./index.ts";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const start = new Date("2026-10-17T09:00:00Z");
const at = (ms: number) => new Date(start.getTime() + ms);

// Человек тратит 1 с на реакцию и 200 мс на букву.
const typist = (letters: number): SpeedSample => ({
  letters,
  elapsedMs: 1000 + 200 * letters,
});
const history = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(typist);

describe("скорость", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("оценивает время реакции по истории", () => {
    expect(estimateReactionMs(history)).toBeCloseTo(1000);
  });

  it("пока истории мало — реакция по умолчанию и скорость обычная", () => {
    expect(estimateReactionMs(history.slice(0, 3))).toBe(DEFAULT_REACTION_MS);
    expect(classifySpeed({ letters: 5, elapsedMs: 9000 }, [])).toBe("normal");
  });

  it("длинное слово, набранное в обычном темпе, — не медленно", () => {
    expect(classifySpeed(typist(14), history)).toBe("normal");
    expect(classifySpeed(typist(3), history)).toBe("normal");
  });

  it("быстро и медленно — относительно своего темпа на букву", () => {
    expect(classifySpeed({ letters: 10, elapsedMs: 2000 }, history)).toBe(
      "fast",
    );
    expect(classifySpeed({ letters: 10, elapsedMs: 6000 }, history)).toBe(
      "slow",
    );
  });

  it("больше минуты — медленно и в историю не идёт", () => {
    const long = { letters: 5, elapsedMs: 90_000 };
    expect(classifySpeed(long, history)).toBe("slow");
    expect(pushSpeedSample(history, long)).toHaveLength(history.length);
  });

  it("история ограничена", () => {
    let h: SpeedSample[] = [];
    for (let i = 0; i < SPEED_HISTORY_SIZE + 5; i++) {
      h = pushSpeedSample(h, typist(5));
    }
    expect(h).toHaveLength(SPEED_HISTORY_SIZE);
  });
});

describe("лестница", () => {
  it("ввод: верно или с опечаткой — готово, иначе выбор", () => {
    expect(nextStage({ stage: "type", verdict: "correct" })).toBe("done");
    expect(nextStage({ stage: "type", verdict: "typo" })).toBe("done");
    expect(nextStage({ stage: "type", verdict: "partial" })).toBe("choice");
    expect(nextStage({ stage: "type", verdict: "other-word" })).toBe("choice");
    expect(nextStage({ stage: "type", verdict: "wrong" })).toBe("choice");
  });

  it("выбор: ошибка — показ; показ повторяется, пока не перепишешь", () => {
    expect(nextStage({ stage: "choice", correct: true })).toBe("done");
    expect(nextStage({ stage: "choice", correct: false })).toBe("show");
    expect(nextStage({ stage: "show", correct: false })).toBe("show");
    expect(nextStage({ stage: "show", correct: true })).toBe("done");
  });

  it("оценка FSRS по первому шагу и скорости", () => {
    const correct = { stage: "type", verdict: "correct" } as const;
    expect(gradeAttempt(correct, "fast")).toBe(Rating.Easy);
    expect(gradeAttempt(correct, "normal")).toBe(Rating.Good);
    expect(gradeAttempt(correct, "slow")).toBe(Rating.Hard);
    expect(gradeAttempt({ stage: "type", verdict: "typo" }, "fast")).toBe(
      Rating.Hard,
    );
    expect(gradeAttempt({ stage: "type", verdict: "wrong" }, "fast")).toBe(
      Rating.Again,
    );
    expect(gradeAttempt({ stage: "choice", correct: true }, "fast")).toBe(
      Rating.Again,
    );
  });
});

describe("интервалы", () => {
  it("новое слово: вероятность 0, статус «новое»", () => {
    const card = newCard(start);
    expect(recallProbability(card, start)).toBe(0);
    expect(wordStatus(card)).toBe("new");
  });

  it("невспомненное слово крутится в горячем круге 1 → 5 → 15 минут", () => {
    let card = reviewCard(newCard(start), Rating.Again, start);
    expect(isHot(card)).toBe(true);
    expect(card.due.getTime() - start.getTime()).toBe(MINUTE);

    card = reviewCard(card, Rating.Good, at(MINUTE));
    expect(isHot(card)).toBe(true);
    expect(card.due.getTime() - at(MINUTE).getTime()).toBe(5 * MINUTE);

    card = reviewCard(card, Rating.Good, at(6 * MINUTE));
    expect(card.due.getTime() - at(6 * MINUTE).getTime()).toBe(15 * MINUTE);

    card = reviewCard(card, Rating.Good, at(21 * MINUTE));
    expect(isHot(card)).toBe(false);
    expect(card.state).toBe(State.Review);
    expect(
      card.due.getTime() - at(21 * MINUTE).getTime(),
    ).toBeGreaterThanOrEqual(DAY);
  });

  it("ошибка в выученном слове возвращает его в горячий круг", () => {
    let card = newCard(start);
    let now = start;
    for (const step of [0, MINUTE, 5 * MINUTE, 15 * MINUTE]) {
      now = at(now.getTime() - start.getTime() + step);
      card = reviewCard(card, Rating.Good, now);
    }
    expect(card.state).toBe(State.Review);
    const lapse = reviewCard(card, Rating.Again, card.due);
    expect(lapse.state).toBe(State.Relearning);
    expect(lapse.due.getTime() - card.due.getTime()).toBe(MINUTE);
  });

  it("статусы «с ошибками» и «выучено»", () => {
    const card = reviewCard(newCard(start), Rating.Hard, start);
    expect(wordStatus(card, Rating.Hard)).toBe("errors");
    expect(wordStatus({ ...card, state: State.Review, stability: 30 })).toBe(
      "learned",
    );
    expect(wordStatus({ ...card, state: State.Review, stability: 5 })).toBe(
      "learning",
    );
  });
});
