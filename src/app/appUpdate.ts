import { registerSW } from "virtual:pwa-register";
import { create } from "zustand";

// Обновление приложения. Новая версия скачивается сама, но включается только по кнопке
// «Обновить» на плашке (UpdateBanner): так страница не перезагрузится посреди ответа.
// Браузер ищет новую версию только при запуске, а приложение с экрана «Домой» живёт днями —
// поэтому проверяем и при каждом возврате в приложение.

interface AppUpdateState {
  /** Новая версия скачана и ждёт включения. */
  ready: boolean;
  updating: boolean;
  /** Включить новый service worker и перезагрузить страницу. */
  apply: () => void;
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export const useAppUpdate = create<AppUpdateState>()((set) => ({
  ready: false,
  updating: false,
  apply: () => {
    set({ updating: true });
    // Если новый service worker почему-то не включится — всё равно перезагрузить страницу.
    setTimeout(() => window.location.reload(), 3000);
    void updateSW?.(true);
  },
}));

export function registerAppUpdates() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useAppUpdate.setState({ ready: true });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
    },
  });
}
