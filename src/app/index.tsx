import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { registerAppUpdates } from "./appUpdate.ts";
import "./styles/index.css";

// Service worker нужен для уведомлений; новая версия включается по плашке «Обновить».
registerAppUpdates();

const container = document.getElementById("root");
if (!container) throw new Error("нет #root в index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
