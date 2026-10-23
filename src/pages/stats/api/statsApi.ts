import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/shared/api";

const dayStatsSchema = z.object({
  day: z.string(),
  total: z.number(),
  clean: z.number(),
});
export type DayStats = z.infer<typeof dayStatsSchema>;

export const statsSchema = z.object({
  words: z.object({
    total: z.number(),
    new: z.number(),
    learning: z.number(),
    errors: z.number(),
    learned: z.number(),
    reverse: z.number(),
  }),
  today: dayStatsSchema,
  streak: z.number(),
  days: z.array(dayStatsSchema),
  allTime: z.object({ total: z.number(), clean: z.number() }),
  hardest: z.array(
    z.object({
      wordId: z.number(),
      prompt: z.string(),
      answer: z.string(),
      misses: z.number(),
    }),
  ),
});
export type Stats = z.infer<typeof statsSchema>;

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => apiFetch("/stats", { schema: statsSchema }),
    staleTime: 0,
  });
}
