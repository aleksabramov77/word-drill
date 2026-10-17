import { z } from "zod";

export const settingsSchema = z.object({
  windowStart: z.number(),
  windowEnd: z.number(),
  minGapMinutes: z.number(),
  dailyPushLimit: z.number(),
  newPerDay: z.number(),
  timeZone: z.string(),
});
export type Settings = z.infer<typeof settingsSchema>;

/** Форма расписания: те же ограничения, что на сервере (server/push/service.ts). */
export const scheduleFormSchema = z
  .object({
    windowStart: z.number().int().min(0).max(23),
    windowEnd: z.number().int().min(1).max(24),
    minGapMinutes: z.number().int().min(5, "Не меньше 5 минут").max(720),
    dailyPushLimit: z.number().int().min(1).max(100),
    newPerDay: z.number().int().min(0).max(50),
  })
  .refine((v) => v.windowEnd > v.windowStart, {
    path: ["windowEnd"],
    message: "Конец окна должен быть позже начала",
  });
export type ScheduleForm = z.infer<typeof scheduleFormSchema>;
