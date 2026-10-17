import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/shared/api";
import {
  dictionaryUnitSchema,
  dictionaryWordSchema,
  searchHitSchema,
} from "../model/types.ts";

const STATIC = { staleTime: Number.POSITIVE_INFINITY };

export function useDictionarySearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["dictionary", "search", q],
    queryFn: () =>
      apiFetch(`/dictionary/search?q=${encodeURIComponent(q)}`, {
        schema: z.object({ hits: z.array(searchHitSchema) }),
      }).then((data) => data.hits),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    ...STATIC,
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ["dictionary", "units"],
    queryFn: () =>
      apiFetch("/dictionary/units", {
        schema: z.object({ units: z.array(dictionaryUnitSchema) }),
      }).then((data) => data.units),
    ...STATIC,
  });
}

export function useUnitWords(unit: number | null) {
  return useQuery({
    queryKey: ["dictionary", "unit", unit],
    queryFn: () =>
      apiFetch(`/dictionary/units/${unit}`, {
        schema: z.object({
          unit: dictionaryUnitSchema,
          words: z.array(dictionaryWordSchema),
        }),
      }),
    enabled: unit !== null,
    ...STATIC,
  });
}
