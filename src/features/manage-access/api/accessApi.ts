import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/shared/api";

const entrySchema = z.object({
  email: z.string(),
  name: z.string(),
  status: z.enum(["approved", "pending", "denied"]),
  requestedAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
});
export type AccessEntry = z.infer<typeof entrySchema>;

const accessSchema = z.object({
  admins: z.array(z.string()),
  entries: z.array(entrySchema),
  users: z.array(
    z.object({
      email: z.string(),
      name: z.string(),
      createdAt: z.string(),
      words: z.number(),
    }),
  ),
});
export type AccessOverview = z.infer<typeof accessSchema>;

const ACCESS_KEY = ["admin", "access"] as const;

export function useAccess() {
  return useQuery({
    queryKey: ACCESS_KEY,
    queryFn: () => apiFetch("/admin/access", { schema: accessSchema }),
  });
}

export function useDecide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; status: "approved" | "denied" }) =>
      apiFetch("/admin/access", { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCESS_KEY }),
  });
}

export function useRemoveAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch("/admin/access/remove", { method: "POST", body: { email } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCESS_KEY }),
  });
}
