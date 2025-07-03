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

        if (currentState.mode === mode && !currentState.isFirstRender) return;
        if (typeof window !== "undefined") {
          const colors = COLORS[mode];
          const isFirstRender = currentState.isFirstRender;
          document.documentElement.classList.remove("dark", "light");
          document.body.classList.remove("dark", "light");
          document.documentElement.classList.add(mode);
          document.body.classList.add(mode);
          if (mode === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
          if (isFirstRender) {
            document.body.style.transition = "none";
            document.body.style.backgroundColor = colors.bg;
            document.body.style.color = colors.fg;
            if (typeof window !== "undefined" && window.requestAnimationFrame) {
              window.requestAnimationFrame(() => {
                document.body.style.transition =
                  "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)";
              });
            }
          } else {
            if (!document.body.style.transition.includes("background-color")) {
              document.body.style.transition =
                "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)";
            }
            document.body.style.backgroundColor = colors.bg;
            document.body.style.color = colors.fg;
          }
        }

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
        return (state, error) => {
          if (error) {
            console.error("Failed to rehydrate color mode store:", error);
            return;
          }

          if (typeof window !== "undefined") {
            const oldMode = localStorage.getItem("selectedMode");
            if (oldMode) {
              localStorage.removeItem("selectedMode");
            }

            setTimeout(() => {
              const currentState = useColorModeStore.getState();
              useColorModeStore.setState({ hasHydrated: true });

              if (currentState.mode) {
                useColorModeStore.setState({ isFirstRender: true });
                currentState.setMode(currentState.mode);
              }
            }, 0);
          }
        };
      },
    }
  )
);
