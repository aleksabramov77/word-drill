import { useEffect } from "react";

// Нажатие на уведомление при открытом приложении (src/app/sw.ts → notificationclick).
// Два пути к одному переходу:
// - сообщение из service worker — мгновенно, если страница не спит;
// - запись в Cache Storage — страница проверяет её, когда выходит на экран: на iPhone сообщение
//   теряется, если приложение просыпается из фона. Нажатие и выход на экран идут параллельно,
//   поэтому после выхода на экран запись проверяется ещё несколько раз.
const PENDING_CACHE = "pending-open";
const PENDING_KEY = "/__pending-open";
/** Запись старше минуты — не от этого нажатия, по ней не переходим. */
const PENDING_TTL_MS = 60_000;
const RECHECK_MS = [0, 300, 1000, 2500];

const parsePending = (value: unknown): { url: string; at: number } | null => {
  if (typeof value !== "object" || value === null) return null;
  const { url, at } = value as { url?: unknown; at?: unknown };
  return typeof url === "string" && typeof at === "number" ? { url, at } : null;
};

async function takePending(): Promise<string | null> {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(PENDING_CACHE);
    const response = await cache.match(PENDING_KEY);
    if (!response) return null;
    await cache.delete(PENDING_KEY);
    const pending = parsePending(await response.json());
    if (!pending || Date.now() - pending.at > PENDING_TTL_MS) return null;
    return pending.url;
  } catch {
    return null;
  }
}

async function clearPending() {
  if (!("caches" in window)) return;
  try {
    await (await caches.open(PENDING_CACHE)).delete(PENDING_KEY);
  } catch {
    // нечего чистить
  }
}

/** Переход только внутри своего сайта: путь + параметры. */
function toPath(url: string): string | null {
  const parsed = new URL(url, window.location.origin);
  if (parsed.origin !== window.location.origin) return null;
  return `${parsed.pathname}${parsed.search}`;
}

export function useOpenFromNotification(navigate: (path: string) => void) {
  useEffect(() => {
    const go = (url: string) => {
      const path = toPath(url);
      if (path) navigate(path);
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type !== "open-url" || !data.url) return;
      void clearPending();
      go(data.url);
    };

    const timers: ReturnType<typeof setTimeout>[] = [];
    const checkPending = () => {
      for (const t of timers.splice(0)) clearTimeout(t);
      for (const delay of RECHECK_MS) {
        timers.push(
          setTimeout(() => {
            void takePending().then((url) => url && go(url));
          }, delay),
        );
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") checkPending();
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkPending);
    checkPending();
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkPending);
      for (const t of timers) clearTimeout(t);
    };
  }, [navigate]);
}
