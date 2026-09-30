import { create } from "zustand";

/**
 * Colour theme: the user's choice ("system" follows the OS) is kept in this
 * browser's localStorage; the resolved value is written to
 * <html data-theme="light|dark">, which index.css and Tailwind's `dark:`
 * variant read. index.html applies the same logic before first paint so the
 * page never flashes the wrong theme.
 */
export type ThemeChoice = "light" | "dark" | "system";

const KEY = "ai-canva-theme";
const media = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // Storage blocked (private mode etc.) — fall back to the OS setting.
  }
  return "system";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "light" | "dark" {
  return choice === "system" ? (systemDark ? "dark" : "light") : choice;
}

function apply(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#1a1d22" : "#ffffff");
}

interface ThemeState {
  /** What the user picked. */
  choice: ThemeChoice;
  /** What is actually showing. */
  resolved: "light" | "dark";
  setChoice: (choice: ThemeChoice) => void;
}

/** Shared theme store — the header toggle writes it, the canvas reads it. */
export const useTheme = create<ThemeState>((set) => {
  const initial = readThemeChoice();
  const resolved = resolveTheme(initial, !!media()?.matches);
  apply(resolved);

  // Follow the OS while the choice is "system".
  media()?.addEventListener("change", (e) => {
    set((s) => {
      if (s.choice !== "system") return s;
      const r = e.matches ? "dark" : "light";
      apply(r);
      return { resolved: r };
    });
  });

  return {
    choice: initial,
    resolved,
    setChoice: (choice) => {
      try {
        localStorage.setItem(KEY, choice);
      } catch {
        // Not persisted this session; the choice still applies.
      }
      const r = resolveTheme(choice, !!media()?.matches);
      apply(r);
      set({ choice, resolved: r });
    },
  };
});
