import { create } from "zustand";
import { APP_VERSION } from "@/shared/config";

// Обновление приложения. Новый service worker включается сразу (src/app/sw.ts), а страница решает,
// когда перезагрузиться на новую версию:
// - только что открыл приложение или вернулся в него (первые 10 секунд) — сама, незаметно;
// - уже отвечаешь — плашка «Обновить» (UpdateBanner), а при следующем возврате — сама.
// Новую версию ищем при запуске, при каждом возврате в приложение и при каждом уведомлении
// (service worker), плюс кнопка «Проверить обновление» в «Ещё».

const FRESH_MS = 10_000;
const CHECK_WAIT_MS = 6_000;

interface AppUpdateState {
  /** Новая версия уже работает в service worker — нужна перезагрузка страницы. */
  ready: boolean;
  /** Её номер — с сервера (/api/health). */
  version: string | null;
  checking: boolean;
  apply: () => void;
  /** «Проверить обновление»: true — нашлась и применяется, false — уже последняя. */
  check: () => Promise<boolean>;
}

let registration: ServiceWorkerRegistration | undefined;
/** Когда страница последний раз вышла на экран: обновление сразу после этого применяем само. */
let visibleSince = Date.now();
let reloading = false;

function reload() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

async function serverVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

export const useAppUpdate = create<AppUpdateState>()((set, get) => ({
  ready: false,
  version: null,
  checking: false,
  apply: reload,
  check: async () => {
    set({ checking: true });
    try {
      const latest = await serverVersion();
      if (get().ready) {
        reload();
        return true;
      }
      if (!latest || latest === APP_VERSION) return false;
      // Новая версия на сервере: скачать её service worker'ом и перезагрузиться.
      const changed = new Promise<void>((resolve) => {
        navigator.serviceWorker?.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
        setTimeout(resolve, CHECK_WAIT_MS);
      });
      await registration?.update().catch(() => undefined);
      await changed;
      reload();
      return true;
    } finally {
      set({ checking: false });
    }
  },
}));

function onNewVersion() {
  if (Date.now() - visibleSince < FRESH_MS) {
    reload();
    return;
  }
  useAppUpdate.setState({ ready: true });
  void serverVersion().then((version) => useAppUpdate.setState({ version }));
}

export function registerAppUpdates() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  // Первая смена управляющего без прежнего service worker'а — это установка, а не обновление.
  let controlled = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controlled) onNewVersion();
    controlled = true;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    visibleSince = Date.now();
    if (useAppUpdate.getState().ready) reload();
    else void registration?.update().catch(() => undefined);
  });
  void navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((r) => {
      registration = r;
    })
    .catch(() => undefined);
}
