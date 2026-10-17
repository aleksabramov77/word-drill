import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError, apiFetch } from "@/shared/api";

const meSchema = z.object({
  user: z.object({ email: z.string(), name: z.string() }),
  mode: z.enum(["google", "dev"]),
});
export type Me = z.infer<typeof meSchema>;

const ME_KEY = ["auth", "me"] as const;

/** Кто вошёл; null — не вошёл (401). */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () =>
      apiFetch("/auth/me", { schema: meSchema }).catch((error) => {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }),
    staleTime: 5 * 60_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, null);
    },
  });
}

/** Начать вход через Google — полный переход на сервер (OAuth редиректы). */
export const GOOGLE_LOGIN_URL = "/api/auth/google";
