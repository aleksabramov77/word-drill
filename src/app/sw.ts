/// <reference lib="webworker" />
// Service worker: кэш сборки (vite-plugin-pwa, injectManifest) и уведомления.
// Типы — из tsconfig.sw.json (lib webworker), основной tsconfig этот файл не проверяет.
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("install", () => {
  void self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

interface PushData {
  title: string;
  body: string;
  url: string;
  tag: string;
}

self.addEventListener("push", (event) => {
  const data: PushData = event.data?.json() ?? {
    title: "Word Drill",
    body: "Пора повторить слова",
    url: "/",
    tag: "word",
  };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      data: { url: data.url },
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
    }),
  );
});

// Куда перейти после нажатия на уведомление — запись в Cache Storage, её читает страница
// (src/app/openFromNotification.ts). Сообщение из service worker на iPhone теряется, если страница
// ещё «спит» в фоне, а запись страница прочитает сама, когда выйдет на экран.
const PENDING_CACHE = "pending-open";
const PENDING_KEY = "/__pending-open";

// Нажатие на уведомление — открыть тренировку этого слова (в уже открытом окне, если оно есть).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data as { url?: string } | null)?.url ?? "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find((w) => w.focused) ?? windows[0];
      if (open) {
        // Приложение уже открыто (на любом экране): переходит само, без перезагрузки —
        // navigate() у окна на iPhone не срабатывает.
        const cache = await caches.open(PENDING_CACHE);
        await cache.put(
          PENDING_KEY,
          new Response(JSON.stringify({ url, at: Date.now() })),
        );
        open.postMessage({ type: "open-url", url });
        await open.focus().catch(() => undefined);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
