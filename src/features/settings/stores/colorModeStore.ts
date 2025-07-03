import { create } from "zustand";
import { persist } from "zustand/middleware";

type ColorMode = "dark" | "light";

interface ColorModeState {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  darkClass: string;
}

const COLORS = {
  dark: { bg: "#212225", fg: "#E8EAED" },
  light: { bg: "#fff", fg: "#212225" },
};

const TRANSITION =
  "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1), border-color 0.2s cubic-bezier(0.4,0,0.2,1)";

function applyDarkModeStyles(mode: ColorMode) {
  if (typeof window === "undefined") return;

  const colors = COLORS[mode];
  const body = document.body;
  const html = document.documentElement;

  if (!body || !html || !body.style || !html.style) {
    return;
  }

  if (mode === "dark") {
    html.classList.add("dark");
    body.classList.add("dark");
  } else {
    html.classList.remove("dark");
    body.classList.remove("dark");
  }

  body.style.setProperty("background-color", colors.bg, "important");
  body.style.setProperty("color", colors.fg, "important");
  body.style.setProperty("transition", TRANSITION, "important");

  html.style.setProperty("--color-bg", colors.bg);
  html.style.setProperty("--color-fg", colors.fg);
  html.style.setProperty("--color-border", mode === "dark" ? "#444" : "#e5e7eb");
  html.style.setProperty("--transition-colors", TRANSITION);
}

export const useColorModeStore = create<ColorModeState>()(
  persist(
    (set, get) => ({
      mode: "light",
      darkClass: "",

      setMode: (mode: ColorMode) => {
        const currentState = get();

        if (currentState.mode === mode) {
          return;
        }

        applyDarkModeStyles(mode);

        set({
          mode,
          darkClass: mode === "dark" ? "dark" : "",
        });
      },
    }),
    {
      name: "color-mode-storage",
      version: 1,
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error("Failed to rehydrate color mode store:", error);
            return;
          }
        };
      },
    }
  )
);
