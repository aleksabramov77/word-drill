import { describe, expect, it } from "vitest";
import { scheduleFormSchema } from "./schema.ts";

const valid = {
  windowStart: 9,
  windowEnd: 22,
  minGapMinutes: 20,
  dailyPushLimit: 30,
  newPerDay: 5,
};

describe("форма расписания", () => {
  it("пропускает нормальные значения", () => {
    expect(scheduleFormSchema.safeParse(valid).success).toBe(true);
  });

  it("конец окна позже начала, пауза от 5 минут", () => {
    expect(
      scheduleFormSchema.safeParse({ ...valid, windowEnd: 9 }).success,
    ).toBe(false);
    expect(
      scheduleFormSchema.safeParse({ ...valid, minGapMinutes: 1 }).success,
    ).toBe(false);
  });
});
