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

// DOM要素にダークモードスタイルを一括適用する関数
function applyDarkModeStyles(mode: ColorMode) {
  if (typeof window === "undefined") return;

  const colors = COLORS[mode];
  const body = document.body;
  const html = document.documentElement;

  // クラス更新
  if (mode === "dark") {
    html.classList.add("dark");
    body.classList.add("dark");
  } else {
    html.classList.remove("dark");
    body.classList.remove("dark");
  }

  // bodyのスタイル更新（importantフラグで確実に適用）
  body.style.setProperty("background-color", colors.bg, "important");
  body.style.setProperty("color", colors.fg, "important");
  body.style.setProperty("transition", TRANSITION, "important");

  // CSS変数を設定してすべての要素で統一されたスタイルを使用
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

        // DOM操作を一括で実行
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

          // DOM操作は別途useEffectで行う
          // ここではhasHydratedフラグのみ設定
        };
      },
    }
  )
);
