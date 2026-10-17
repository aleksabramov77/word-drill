import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { wordKeys } from "@/entities/word";
import { apiFetch } from "@/shared/api";
import {
  drillQueueSchema,
  type Stage,
  stepResultSchema,
} from "../model/types.ts";

export const drillKeys = { next: ["drill", "next"] as const };

export function useDrillQueue() {
  return useQuery({
    queryKey: drillKeys.next,
    queryFn: () => apiFetch("/drill/next", { schema: drillQueueSchema }),
    staleTime: 0,
  });
}

export function useAnswerStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      wordId,
      ...step
    }: {
      wordId: number;
      stage: Stage;
      input: string;
      elapsedMs?: number;
    }) =>
      apiFetch(`/drill/${wordId}/step`, {
        method: "POST",
        body: step,
        schema: stepResultSchema,
      }),
    onSuccess: (result) => {
      if (result.next === "done") {
        void queryClient.invalidateQueries({ queryKey: wordKeys.all });
      }
    },
  });
}
