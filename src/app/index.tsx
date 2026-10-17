import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles/index.css";

// Service worker нужен для уведомлений; обновляется сам при новой версии сайта.
// Браузер ищет новую версию только при запуске, а приложение с экрана «Домой» живёт днями —
// поэтому проверяем и при каждом возврате в приложение. Новая версия перезагружает страницу сама.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void registration.update();
    });
  },
});

const container = document.getElementById("root");
if (!container) throw new Error("нет #root в index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
