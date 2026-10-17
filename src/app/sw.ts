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

// Нажатие на уведомление — открыть карточку этого слова (в уже открытом окне, если оно есть).
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
      const open = windows[0];
      if (open) {
        await open.focus();
        await open.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
