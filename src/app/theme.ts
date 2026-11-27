import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const prefersDark =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: prefersDark ? "dark" : "light",
      toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "sb-theme" },
  ),
);

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0b1220" : "#0f766e");
}
