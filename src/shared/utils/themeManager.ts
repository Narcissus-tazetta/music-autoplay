export type Theme = "light" | "dark";

export class ThemeManager {
    private static readonly STORAGE_KEY = "theme";
    private static readonly DEFAULT_THEME: Theme = "dark";

    static getTheme(): Theme {
        if (typeof window === "undefined") return this.DEFAULT_THEME;

        const stored = localStorage.getItem(this.STORAGE_KEY) as Theme;
        if (stored === "light" || stored === "dark") return stored;

        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return prefersDark ? "dark" : "light";
    }

    static setTheme(theme: Theme): void {
        if (typeof window === "undefined") return;

        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem(this.STORAGE_KEY, theme);
        window.dispatchEvent(new CustomEvent("theme-changed", { detail: theme }));
    }

    static toggleTheme(): Theme {
        const current = this.getTheme();
        const newTheme = current === "dark" ? "light" : "dark";
        this.setTheme(newTheme);
        return newTheme;
    }

    static initialize(): void {
        if (typeof window === "undefined") return;

        const theme = this.getTheme();
        this.setTheme(theme);
    }
}
