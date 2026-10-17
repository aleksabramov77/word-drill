import { APP_VERSION } from "@/shared/config";

/**
 * Записать событие в журнал на сервере (server/log.ts) — для разбора проблем, видных только на
 * устройстве. Не ждёт ответа и не падает: журнал не должен мешать приложению.
 */
export function logEvent(event: string, data?: Record<string, unknown>): void {
  try {
    void fetch("/api/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Version": APP_VERSION,
      },
      body: JSON.stringify({ event, data }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // нечего делать
  }
}
