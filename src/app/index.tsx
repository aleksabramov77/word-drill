import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) throw new Error("нет #root в index.html");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
