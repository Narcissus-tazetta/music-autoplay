import { useEffect } from "react";
import { useColorModeStore } from "../../features/settings/stores/colorModeStore";

export function ThemeInitializer() {
    const mode = useColorModeStore((s) => s.mode);
    const setMode = useColorModeStore((s) => s.setMode);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // If there's a persisted mode from the store, apply it immediately.
        if (mode) {
            // apply class immediately to avoid flicker
            if (mode === "dark") document.documentElement.classList.add("dark");
            else document.documentElement.classList.remove("dark");
            // ensure store persists the mode
            setMode(mode);
            return;
        }

        // No persisted mode: use system preference
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initial = prefersDark ? "dark" : "light";
        if (initial === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
        setMode(initial);
    }, [mode, setMode]);

    return null;
}
