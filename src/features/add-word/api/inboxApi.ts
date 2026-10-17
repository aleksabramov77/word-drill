import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/shared/api";

const suggestionSchema = z.object({
  word: z.object({
    en: z.string(),
    ru: z.array(z.string()),
    units: z.array(z.number()),
    missing: z.boolean(),
  }),
  matchedRu: z.string().nullable(),
});

const itemSchema = z.object({
  id: z.number(),
  text: z.string(),
  createdAt: z.string(),
  suggestions: z.array(suggestionSchema),
});
export type InboxItem = z.infer<typeof itemSchema>;

const INBOX_KEY = ["inbox"] as const;

export function useInbox() {
  return useQuery({
    queryKey: INBOX_KEY,
    queryFn: () =>
      apiFetch("/inbox", {
        schema: z.object({ items: z.array(itemSchema) }),
      }).then((d) => d.items),
  });
}

export function useAddInboxText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      apiFetch("/inbox", { method: "POST", body: { text } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INBOX_KEY }),
  });
}

export function useDeleteInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/inbox/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INBOX_KEY }),
  });
}
