import { describe, expect, it } from "vitest";
import { Rating } from "../../src/shared/lib/srs/index.ts";
import { fixtureDictionary } from "../dictionary/fixture.ts";
import { createTestApp } from "../testing.ts";
import {
  addWord,
  answerStep,
  deleteWord,
  drillQueue,
  listWords,
  updateWord,
} from "./service.ts";

const MINUTE = 60_000;

function setup() {
  const ctx = createTestApp();
  const add = (prompt: string, answers: string[]) => {
    const word = addWord(
      ctx.db,
      ctx.userId,
      { prompt, answers, source: "manual" },
      ctx.clock.now(),
    );
    if (word === "duplicate") throw new Error("duplicate");
    return word;
  };
  const step = (
    wordId: number,
    stage: "type" | "choice" | "show",
    input: string,
    elapsedMs?: number,
  ) => {
    const result = answerStep(
      ctx.db,
      fixtureDictionary,
      ctx.userId,
      wordId,
      { stage, input, elapsedMs },
      ctx.clock.now(),
    );
    if (!result) throw new Error("no word");
    return result;
  };
  return { ...ctx, add, step };
}

describe("слова", () => {
  it("добавляет, не даёт дубль по русскому слову, правит и удаляет", () => {
    const { db, userId, clock, add } = setup();
    const word = add("кровь", ["blood", "Blood"]);
    expect(word.status).toBe("new");
    expect(word.answers).toEqual(["blood"]);
    expect(
      addWord(
        db,
        userId,
        { prompt: "кровь", answers: ["x"], source: "manual" },
        clock.now(),
      ),
    ).toBe("duplicate");

    const updated = updateWord(
      db,
      userId,
      word.id,
      { answers: ["blood", "gore"] },
      clock.now(),
    );
    expect(updated).not.toBe("duplicate");
    expect(listWords(db, userId, clock.now())[0]?.answers).toEqual([
      "blood",
      "gore",
    ]);

    expect(deleteWord(db, userId, word.id)).toBe(true);
    expect(deleteWord(db, userId, word.id)).toBe(false);
    expect(listWords(db, userId, clock.now())).toEqual([]);
  });
});

describe("тренировка", () => {
  it("верный ввод нового слова — Good, слово уходит в горячий круг", () => {
    const { add, step, db, userId, clock } = setup();
    const word = add("кровь", ["blood"]);
    expect(drillQueue(db, userId, clock.now()).card).toMatchObject({
      wordId: word.id,
      prompt: "кровь",
      letters: 5,
      isNew: true,
    });

    const result = step(word.id, "type", "Blood", 3000);
    expect(result).toMatchObject({
      verdict: "correct",
      correct: true,
      next: "done",
    });
    expect(result.outcome?.grade).toBe(Rating.Good);
    expect(result.outcome?.status).toBe("learning");

    const queue = drillQueue(db, userId, clock.now());
    expect(queue.card).toBeNull();
    expect(queue.nextDue).not.toBeNull();
  });

  it("опечатка — Hard и статус «с ошибками»", () => {
    const { add, step } = setup();
    const word = add("кровь", ["blood"]);
    const result = step(word.id, "type", "blod", 3000);
    expect(result).toMatchObject({
      verdict: "typo",
      correct: true,
      expected: "blood",
      next: "done",
    });
    expect(result.outcome?.grade).toBe(Rating.Hard);
    expect(result.outcome?.status).toBe("errors");
  });

  it("лестница: неверно → выбор → неверно → показ → переписал; оценка Again, возврат через минуту", () => {
    const { add, step, db, userId, clock } = setup();
    const word = add("кровь", ["blood"]);
    add("вода", ["water"]);

    const typed = step(word.id, "type", "xyz", 4000);
    expect(typed).toMatchObject({
      verdict: "wrong",
      correct: false,
      next: "choice",
    });
    expect(typed.options).toHaveLength(4);
    expect(typed.options).toContain("blood");

    const chosen = step(word.id, "choice", "flood");
    expect(chosen).toMatchObject({
      correct: false,
      next: "show",
      expected: "blood",
    });

    expect(step(word.id, "show", "blod")).toMatchObject({
      correct: false,
      next: "show",
    });

    const copied = step(word.id, "show", "blood");
    expect(copied.next).toBe("done");
    expect(copied.outcome?.grade).toBe(Rating.Again);
    expect(copied.outcome?.hot).toBe(true);
    expect(
      new Date(copied.outcome?.due ?? "").getTime() - clock.now().getTime(),
    ).toBe(MINUTE);

    // Через 2 минуты слово снова первое — горячий круг важнее новых слов.
    clock.advance(2 * MINUTE);
    const queue = drillQueue(db, userId, clock.now());
    expect(queue.card).toMatchObject({
      wordId: word.id,
      hot: true,
      isNew: false,
    });
    expect(queue.newCount).toBe(1);
  });

  it("верный выбор после ошибки ввода — тоже Again", () => {
    const { add, step } = setup();
    const word = add("кровь", ["blood"]);
    step(word.id, "type", "xyz");
    const chosen = step(word.id, "choice", "blood");
    expect(chosen.next).toBe("done");
    expect(chosen.outcome?.grade).toBe(Rating.Again);
  });

  it("перевод другого слова из списка", () => {
    const { add, step } = setup();
    const word = add("кровь", ["blood"]);
    add("вода", ["water"]);
    expect(step(word.id, "type", "water")).toMatchObject({
      verdict: "other-word",
      next: "choice",
    });
  });

  it("без включения новых — только то, что пора повторить", () => {
    const { add, db, userId, clock } = setup();
    add("кровь", ["blood"]);
    expect(
      drillQueue(db, userId, clock.now(), { includeNew: false }).card,
    ).toBeNull();
  });
});
