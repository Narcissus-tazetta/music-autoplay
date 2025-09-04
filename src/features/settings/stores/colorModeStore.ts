import { create } from "zustand";
import { persist } from "zustand/middleware";
import { log } from "../../../utils/clientLogger";

type ColorMode = "dark" | "light";

interface ColorModeState {
    mode: ColorMode;
    setMode: (mode: ColorMode) => void;
}

function applyDarkModeStyles(mode: ColorMode) {
    if (typeof window === "undefined") return;

    const html = document.documentElement;

    if (mode === "dark") html.classList.add("dark");
    else html.classList.remove("dark");
}

export const useColorModeStore = create<ColorModeState>()(
    persist(
        (set, get) => ({
            mode: "light",

            setMode: (mode: ColorMode) => {
                const currentState = get();

                if (currentState.mode === mode) return;

                requestAnimationFrame(() => {
                    applyDarkModeStyles(mode);
                });

                set({ mode });
            },
        }),
        {
            name: "color-mode-storage",
            version: 1,
            onRehydrateStorage: () => {
                return (state, error) => {
                    if (error) {
                        log.error("Failed to rehydrate color mode store", error, "colorModeStore");
                        return;
                    }

                    if (state?.mode) {
                        requestAnimationFrame(() => {
                            applyDarkModeStyles(state.mode);
                        });
                    }
                };
            },
        }
    )
);
