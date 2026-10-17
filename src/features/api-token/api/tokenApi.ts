import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/shared/api";

const tokenSchema = z.object({
  id: z.number(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

const TOKENS_KEY = ["tokens"] as const;

export function useTokens() {
  return useQuery({
    queryKey: TOKENS_KEY,
    queryFn: () =>
      apiFetch("/tokens", {
        schema: z.object({ tokens: z.array(tokenSchema) }),
      }).then((d) => d.tokens),
  });
}

export function useCreateToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch("/tokens", {
        method: "POST",
        schema: z.object({ token: z.string() }),
      }).then((d) => d.token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TOKENS_KEY }),
  });
}

export function useDeleteToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TOKENS_KEY }),
  });
}
