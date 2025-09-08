import { create } from "zustand";
import { persist } from "zustand/middleware";
import { log } from "../../../utils/clientLogger";
import {
    applyModeToDocument,
    attachSystemListener,
    detachSystemListener,
    writeStoredMode,
} from "../../../shared/utils/theme";

type ColorMode = "dark" | "light" | "system";

interface ColorModeState {
    mode: ColorMode;
    setMode: (mode: ColorMode) => void;
}

declare global {
    interface Window {
        __colorModeMql?: MediaQueryList;
        __colorModeMqlListener?: (this: MediaQueryList, ev: MediaQueryListEvent) => void;
    }
}

function resolveSystemPreference(): "dark" | "light" {
    if (typeof window === "undefined") return "light";
    try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
        return "light";
    }
}

// delegate DOM work to shared utils
const applyDarkModeStyles = (mode: ColorMode) => applyModeToDocument(mode);

// Top-level helpers so we can attach/detach outside of setMode (useful on initial load/rehydration)
const detachSystemListenerIfExists = () => detachSystemListener();
const attachSystemListenerIfNeeded = () => attachSystemListener();

export const useColorModeStore = create<ColorModeState>()(
    persist(
        (set, get) => ({
            mode:
                typeof window !== "undefined"
                    ? (function () {
                          try {
                              // lazy-read stored value to set initial mode on client
                              // eslint-disable-next-line @typescript-eslint/no-var-requires
                              const { readStoredMode } = require("../../../shared/utils/theme");
                              return readStoredMode() ?? "light";
                          } catch {
                              return "light";
                          }
                      })()
                    : "light",
            setMode: (mode: ColorMode) => {
                const currentState = get();

                // If mode is unchanged, avoid detach/reattach loops. Re-apply styles and ensure listener.
                if (currentState.mode === mode) {
                    if (mode === "system") attachSystemListenerIfNeeded();
                    requestAnimationFrame(() => applyDarkModeStyles(mode));
                    return;
                }

                // If leaving system mode, remove old listener.
                if (currentState.mode === "system") detachSystemListenerIfExists();

                set({ mode });
                // persist
                try {
                    writeStoredMode(mode);
                } catch {}

                // apply immediately and attach listener if needed
                requestAnimationFrame(() => applyDarkModeStyles(mode));
                if (mode === "system") attachSystemListenerIfNeeded();
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
                            // if stored preference is system, attach listener so changes are tracked
                            if (state.mode === "system") {
                                attachSystemListenerIfNeeded();
                            }
                        });
                    }
                };
            },
        }
    )
);
