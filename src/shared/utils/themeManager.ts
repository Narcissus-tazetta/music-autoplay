export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "dark";

export const ThemeManager = {
  getTheme(): Theme {
    if (typeof window === "undefined") return DEFAULT_THEME;

    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") return stored;

    // Fallback to system preference when no stored value exists.
    const prefersDark =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;

    return prefersDark ? "dark" : "light";
  },

  setTheme(theme: Theme): void {
    if (typeof window === "undefined") return;
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent("theme-changed", { detail: theme }));
  },

  toggleTheme(): Theme {
    const current = this.getTheme();
    const newTheme = current === "dark" ? "light" : "dark";
    this.setTheme(newTheme);
    return newTheme;
  },

  initialize(): void {
    if (typeof window === "undefined") return;
    const theme = this.getTheme();
    this.setTheme(theme);
  },
};
