import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/shared/api";
import { vapidKeyToBytes } from "../model/support.ts";

const configSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
  subscriptions: z.number(),
});

const CONFIG_KEY = ["push", "config"] as const;
const DEVICE_KEY = ["push", "device"] as const;

export function usePushConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => apiFetch("/push/config", { schema: configSchema }),
  });
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Подписано ли именно это устройство. */
export function useDeviceSubscribed() {
  return useQuery({
    queryKey: DEVICE_KEY,
    queryFn: async () => (await currentSubscription()) !== null,
  });
}

function useInvalidatePush() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["push"] });
}

export class PermissionDeniedError extends Error {}

export function useSubscribe() {
  const invalidate = useInvalidatePush();
  return useMutation({
    mutationFn: async (publicKey: string) => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new PermissionDeniedError();
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyToBytes(publicKey),
        }));
      await apiFetch("/push/subscribe", {
        method: "POST",
        body: {
          subscription: subscription.toJSON(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
    },
    onSettled: invalidate,
  });
}

export function useUnsubscribe() {
  const invalidate = useInvalidatePush();
  return useMutation({
    mutationFn: async () => {
      const subscription = await currentSubscription();
      if (!subscription) return;
      await apiFetch("/push/unsubscribe", {
        method: "POST",
        body: { endpoint: subscription.endpoint },
      });
      await subscription.unsubscribe();
    },
    onSettled: invalidate,
  });
}

export function useTestPush() {
  return useMutation({
    mutationFn: () =>
      apiFetch("/push/test", {
        method: "POST",
        schema: z.object({ delivered: z.number() }),
      }),
  });
}
