export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "dark";

export function getTheme(): Theme {
    if (typeof window === "undefined") return DEFAULT_THEME;

    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") return stored;

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
    if (typeof window === "undefined") return;
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("theme-changed", { detail: theme }));
}

export function toggleTheme(): Theme {
    const current = getTheme();
    const newTheme = current === "dark" ? "light" : "dark";
    setTheme(newTheme);
    return newTheme;
}

export function initializeTheme(): void {
    if (typeof window === "undefined") return;
    const theme = getTheme();
    setTheme(theme);
}
