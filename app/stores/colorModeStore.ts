import { create } from "zustand";
import { persist } from "zustand/middleware";

type ColorMode = "dark" | "light";

interface ColorModeState {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  darkClass: string;
  isFirstRender: boolean;
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

// カラー定数
const COLORS = {
  dark: { bg: "#212225", fg: "#E8EAED" },
  light: { bg: "#fff", fg: "#212225" },
};

export const useColorModeStore = create<ColorModeState>()(
  persist(
    (set, get) => ({
      mode: "light",
      darkClass: "",
      isFirstRender: true,
      hasHydrated: false,
      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),

      setMode: (mode: ColorMode) => {
        const currentState = get();

        // 既に同じモードの場合は何もしない（無限ループ防止）
        if (currentState.mode === mode) {
          return;
        }

        // DOM操作（クライアントサイドのみ）
        if (typeof window !== "undefined") {
          const colors = COLORS[mode];
          const isFirstRender = currentState.isFirstRender;

          // CSS クラス変更
          document.body.classList.remove("dark", "light");
          document.body.classList.add(mode);

          // スムーズカラー変更
          if (isFirstRender) {
            document.body.style.transition = "";
            document.body.style.backgroundColor = colors.bg;
            document.body.style.color = colors.fg;
          } else {
            document.body.style.transition =
              "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)";
            document.body.style.backgroundColor = colors.bg;
            document.body.style.color = colors.fg;
          }
        }

        // ストア更新
        set({
          mode,
          darkClass: mode === "dark" ? "dark" : "",
          isFirstRender: false,
        });
      },
    }),
    {
      name: "color-mode-storage",
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // 古いlocalStorageからマイグレーション
        if (version === 0 && typeof window !== "undefined") {
          const oldMode = localStorage.getItem("selectedMode") as ColorMode;

          if (oldMode === "dark" || oldMode === "light") {
            const migratedState = {
              mode: oldMode,
              darkClass: oldMode === "dark" ? "dark" : "",
              isFirstRender: true,
              hasHydrated: false,
            };
            return migratedState;
          }
        }
        return persistedState;
      },
      onRehydrateStorage: (_state) => {
        if (typeof window !== "undefined") {
          // 古いキーをクリーンアップ
          const oldMode = localStorage.getItem("selectedMode");
          if (oldMode) {
            localStorage.removeItem("selectedMode");
          }

          // 復元完了をマーク
          setTimeout(() => {
            useColorModeStore.setState({ hasHydrated: true });
          }, 0);
        }
      },
    }
  )
);
