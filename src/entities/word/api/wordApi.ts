import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/shared/api";
import { type NewWord, type Word, wordSchema } from "../model/types.ts";

export const wordKeys = { all: ["words"] as const };
/** Очередь тренировки зависит от списка слов: после изменений её тоже обновляем. */
const DRILL_KEY = ["drill"] as const;

export function useWords() {
  return useQuery({
    queryKey: wordKeys.all,
    queryFn: () =>
      apiFetch("/words", {
        schema: z.object({ words: z.array(wordSchema) }),
      }).then((data) => data.words),
  });
}

function useInvalidateWords() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: wordKeys.all }),
      queryClient.invalidateQueries({ queryKey: DRILL_KEY }),
    ]);
}

export function useAddWord() {
  const invalidate = useInvalidateWords();
  return useMutation({
    mutationFn: (word: NewWord): Promise<Word> =>
      apiFetch("/words", {
        method: "POST",
        body: word,
        schema: z.object({ word: wordSchema }),
      }).then((data) => data.word),
    onSuccess: invalidate,
  });
}

export function useDeleteWord() {
  const invalidate = useInvalidateWords();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/words/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
