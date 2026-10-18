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
    stage: "type" | "hint" | "choice" | "show",
    input: string,
    extra: {
      elapsedMs?: number;
      action?: "reveal" | "choices";
      cells?: string[];
    } = {},
  ) => {
    const result = answerStep(
      ctx.db,
      fixtureDictionary,
      ctx.userId,
      wordId,
      { stage, input, ...extra },
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

    const result = step(word.id, "type", "Blood", { elapsedMs: 3000 });
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
    const result = step(word.id, "type", "blod", { elapsedMs: 3000 });
    expect(result).toMatchObject({
      verdict: "typo",
      correct: true,
      expected: "blood",
      next: "done",
    });
    expect(result.outcome?.grade).toBe(Rating.Hard);
    expect(result.outcome?.status).toBe("errors");
  });

  it("неверный ввод → число букв → шаблон → буква; одна буква из 11 и верный ответ — Hard", () => {
    const { add, step } = setup();
    const word = add("разочарование", ["frustration"]);

    const typed = step(word.id, "type", "frustr");
    expect(typed).toMatchObject({
      verdict: "wrong",
      next: "hint",
      revealed: 0,
      hintLevel: 1,
    });
    expect(typed.mask).toEqual(new Array(11).fill(null));

    const template = step(word.id, "hint", "", { action: "reveal" });
    expect(template).toMatchObject({ next: "hint", revealed: 0, hintLevel: 2 });

    const hinted = step(word.id, "hint", "", { action: "reveal" });
    expect(hinted.next).toBe("hint");
    expect(hinted.mask?.[0]).toBe("f");
    expect(hinted.revealed).toBe(1);

    const solved = step(word.id, "hint", "frustration");
    expect(solved.next).toBe("done");
    expect(solved.outcome?.grade).toBe(Rating.Hard);
  });

  it("верно вписанные в шаблон буквы не открываются — открывается другая свободная", () => {
    const { add, step } = setup();
    const word = add("кровь", ["blood"]);
    step(word.id, "type", "");
    step(word.id, "hint", "", { action: "reveal" }); // шаблон
    // Вписаны «b» и «d» на свои места: подсказка открывает букву между ними.
    for (let k = 0; k < 10; k++) {
      const hinted = step(word.id, "hint", "", {
        action: "reveal",
        cells: ["b", "", "", "", "d"],
      });
      // Неизвестной осталась одна — подсказок больше нет, дальше варианты.
      if (hinted.next !== "hint") break;
      expect(hinted.mask?.[0]).toBeNull();
      expect(hinted.mask?.[4]).toBeNull();
    }
  });

  it("неверная попытка тоже не открывает верно вписанную букву", () => {
    const { add, step } = setup();
    const word = add("кровь", ["blood"]);
    step(word.id, "type", "");
    step(word.id, "hint", "", { action: "reveal" });
    const wrong = step(word.id, "hint", "bxxx", {
      cells: ["b", "x", "x", "x", ""],
    });
    expect(wrong).toMatchObject({ next: "hint", revealed: 1 });
    expect(wrong.mask?.[0]).toBeNull();
  });

  it("«Не помню» — Again, даже если потом вспомнил по одной букве", () => {
    const { add, step } = setup();
    const word = add("разочарование", ["frustration"]);
    expect(step(word.id, "type", "")).toMatchObject({ next: "hint" });
    step(word.id, "hint", "", { action: "reveal" });
    const solved = step(word.id, "hint", "frustration");
    expect(solved.outcome?.grade).toBe(Rating.Again);
  });

  it("каждая неверная попытка подсказывает больше: шаблон, потом буквы; больше 25% букв — Again", () => {
    const { add, step } = setup();
    const word = add("разочарование", ["frustration"]);
    step(word.id, "type", "xyz");
    expect(step(word.id, "hint", "aaa")).toMatchObject({
      hintLevel: 2,
      revealed: 0,
    });
    for (const wrong of ["bbb", "ccc", "ddd"]) {
      const result = step(word.id, "hint", wrong);
      expect(result).toMatchObject({ correct: false, next: "hint" });
    }
    const solved = step(word.id, "hint", "frustration");
    expect(solved.outcome?.grade).toBe(Rating.Again);
  });

  it("открыто больше половины и снова мимо — выбор из вариантов", () => {
    const { add, step } = setup();
    const word = add("кровь", ["blood"]);
    step(word.id, "type", "xyz");
    expect(step(word.id, "hint", "aaa")).toMatchObject({
      next: "hint",
      revealed: 0,
      hintLevel: 2,
    });
    expect(step(word.id, "hint", "bbb")).toMatchObject({
      next: "hint",
      revealed: 1,
    });
    expect(step(word.id, "hint", "ccc")).toMatchObject({
      next: "hint",
      revealed: 2,
    });
    const third = step(word.id, "hint", "ddd");
    expect(third.next).toBe("choice");
    expect(third.options).toHaveLength(4);
  });

  it("лестница до конца: подсказки → «Варианты» → неверно → показ → переписал; Again, возврат через минуту", () => {
    const { add, step, db, userId, clock } = setup();
    const word = add("кровь", ["blood"]);
    add("вода", ["water"]);

    expect(step(word.id, "type", "xyz", { elapsedMs: 4000 }).next).toBe("hint");
    const choices = step(word.id, "hint", "", { action: "choices" });
    expect(choices.next).toBe("choice");
    expect(choices.options).toHaveLength(4);
    expect(choices.options).toContain("blood");

    expect(step(word.id, "choice", "flood")).toMatchObject({
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

  it("верный выбор — тоже Again", () => {
    const { add, step } = setup();
    const word = add("кровь", ["blood"]);
    step(word.id, "type", "xyz");
    step(word.id, "hint", "", { action: "choices" });
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
      next: "hint",
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

describe("несколько переводов", () => {
  it("карточка показывает главную форму крупно, остальные формы из словаря — отдельно", () => {
    const { db, userId, clock, add } = setup();
    add("гораздо", ["by far"]);
    const { card } = drillQueue(db, userId, clock.now(), {
      dictionary: fixtureDictionary,
    });
    expect(card?.prompt).toBe("гораздо");
    expect([...(card?.alsoPrompts ?? [])].sort()).toEqual(
      ["далеко", "значительно", "намного"].sort(),
    );
  });

  it("другой верный перевод: «тоже верно», заготовка без букв, потом верно — «Трудно»", () => {
    const { add, step } = setup();
    const word = add("гораздо", ["by far"]);
    const synonym = step(word.id, "type", "a lot", { elapsedMs: 3000 });
    expect(synonym.verdict).toBe("synonym");
    expect(synonym.next).toBe("hint");
    expect(synonym.revealed).toBe(0);
    expect(synonym.hintLevel).toBe(2);

    // Синоним и на шаге подсказок — не ошибка: буква не открывается.
    const again = step(word.id, "hint", "far");
    expect(again.verdict).toBe("synonym");
    expect(again.next).toBe("hint");
    expect(again.revealed ?? 0).toBe(0);

    const done = step(word.id, "hint", "by far");
    expect(done.next).toBe("done");
    expect(done.outcome?.grade).toBe(Rating.Hard);
  });
});
