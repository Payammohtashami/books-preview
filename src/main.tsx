import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { applyTheme, useTheme } from "@/app/theme";
import "./styles/index.css";

applyTheme(useTheme.getState().theme);
useTheme.subscribe((s) => applyTheme(s.theme));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
