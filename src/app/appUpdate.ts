import { registerSW } from "virtual:pwa-register";
import { create } from "zustand";

// Обновление приложения. Новая версия скачивается сама, но включается только по кнопке
// «Обновить» на плашке (UpdateBanner): так страница не перезагрузится посреди ответа.
// Браузер ищет новую версию только при запуске, а приложение с экрана «Домой» живёт днями —
// поэтому проверяем и при каждом возврате в приложение.

interface AppUpdateState {
  /** Новая версия скачана и ждёт включения. */
  ready: boolean;
  /** Её номер — с сервера (/api/health): он уже работает на новой версии. */
  version: string | null;
  updating: boolean;
  /** Включить новый service worker и перезагрузить страницу. */
  apply: () => void;
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export const useAppUpdate = create<AppUpdateState>()((set) => ({
  ready: false,
  version: null,
  updating: false,
  apply: () => {
    set({ updating: true });
    // Если новый service worker почему-то не включится — всё равно перезагрузить страницу.
    setTimeout(() => window.location.reload(), 3000);
    void updateSW?.(true);
  },
}));

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

export function registerAppUpdates() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useAppUpdate.setState({ ready: true });
      void fetchServerVersion().then((version) =>
        useAppUpdate.setState({ version }),
      );
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
    },
  });
}
