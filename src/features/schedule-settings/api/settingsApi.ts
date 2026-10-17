import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/shared/api";
import { type ScheduleForm, settingsSchema } from "../model/schema.ts";

const SETTINGS_KEY = ["settings"] as const;
const responseSchema = z.object({ settings: settingsSchema });

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () =>
      apiFetch("/settings", { schema: responseSchema }).then((d) => d.settings),
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ScheduleForm & { timeZone?: string }) =>
      apiFetch("/settings", {
        method: "PATCH",
        body: values,
        schema: responseSchema,
      }).then((d) => d.settings),
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_KEY, settings),
  });
}
