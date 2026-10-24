import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SHORTCUT_OPENED_KEY } from "@/features/api-token";
import { registerAppUpdates } from "@/features/app-update";
import { applyFontSize } from "@/features/font-size";
import { logEvent } from "@/shared/api";
import { prepareSpeech } from "@/shared/lib/speech";
import { App } from "./App.tsx";
import "./styles/index.css";

// Размер шрифта, выбранный кнопками A− / A+, — до первой отрисовки.
applyFontSize();

// Service worker нужен для уведомлений; новая версия включается по плашке «Обновить».
registerAppUpdates();

// Голоса для кнопки «Произнести» — заранее, чтобы первое слово не запиналось.
prepareSpeech();

// Журнал (server/log.ts): запуск приложения и ошибки JavaScript — их иначе не увидеть на телефоне.
logEvent("app-open", {
  path: window.location.pathname,
  standalone: window.matchMedia("(display-mode: standalone)").matches,
  sinceShortcutOpenMs: sinceShortcutOpen(),
});
window.addEventListener("error", (e) =>
  logEvent("js-error", {
    message: e.message,
    source: e.filename,
    line: e.lineno,
  }),
);
window.addEventListener("unhandledrejection", (e) =>
  logEvent("js-rejection", { reason: String(e.reason) }),
);

/** Сколько прошло с открытия файла команды (features/api-token): вернулся ли человек после установки. */
function sinceShortcutOpen(): number | null {
  try {
    const at = Number(localStorage.getItem(SHORTCUT_OPENED_KEY));
    if (!at) return null;
    localStorage.removeItem(SHORTCUT_OPENED_KEY);
    return Date.now() - at;
  } catch {
    return null;
  }
}

const container = document.getElementById("root");
if (!container) throw new Error("нет #root в index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
