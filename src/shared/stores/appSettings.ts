import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DayFormat,
  MonthFormat,
  ProgressColor,
  WeekdayFormat,
  YearFormat,
} from "../types/progressSettings";

type ColorMode = "dark" | "light";

interface UISettings {
  theme: ColorMode;
  ytStatusVisible: boolean;
}

interface ProgressSettings {
  showProgress: boolean;
  progressColor: ProgressColor;
  showRemainingText: boolean;
  showCurrentSchedule: boolean;
  showDate: boolean;
  showYear: boolean;
  showMonth: boolean;
  showDay: boolean;
  showWeekday: boolean;
  yearFormat: YearFormat;
  monthFormat: MonthFormat;
  dayFormat: DayFormat;
  weekdayFormat: WeekdayFormat;
  showBackgroundImage: boolean;
  backgroundImageFileName: string;
  backgroundFeatureEnabled: boolean;
}

interface AppSettingsState {
  ui: UISettings;
  progress: ProgressSettings;
  darkClass: string;
  updateUI: (values: Partial<UISettings>) => void;
  updateProgress: (values: Partial<ProgressSettings>) => void;
  setTheme: (mode: ColorMode) => void;
}

const DEFAULT_UI_SETTINGS: UISettings = {
  theme: "light",
  ytStatusVisible: true,
};

const DEFAULT_PROGRESS_SETTINGS: ProgressSettings = {
  showProgress: true,
  progressColor: "green",
  showRemainingText: true,
  showCurrentSchedule: false,
  showDate: false,
  showYear: true,
  showMonth: true,
  showDay: true,
  showWeekday: true,
  yearFormat: "western",
  monthFormat: "japanese",
  dayFormat: "japanese",
  weekdayFormat: "short",
  showBackgroundImage: false,
  backgroundImageFileName: "",
  backgroundFeatureEnabled: false,
};

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
  html.style.setProperty(
    "--color-border",
    mode === "dark" ? "#444" : "#e5e7eb",
  );
  html.style.setProperty("--transition-colors", TRANSITION);
}

export const useAppSettings = create<AppSettingsState>()(
  persist(
    (set, get) => ({
      ui: DEFAULT_UI_SETTINGS,
      progress: DEFAULT_PROGRESS_SETTINGS,
      darkClass: "",

      updateUI: (values) => {
        set((state) => ({
          ui: { ...state.ui, ...values },
        }));
      },

      updateProgress: (values) => {
        set((state) => ({
          progress: { ...state.progress, ...values },
        }));
      },

      setTheme: (mode) => {
        const currentState = get();
        if (currentState.ui.theme === mode) return;

        applyDarkModeStyles(mode);
        set((state) => ({
          ui: { ...state.ui, theme: mode },
          darkClass: mode === "dark" ? "dark" : "",
        }));
      },
    }),
    {
      name: "app-settings-storage",
      version: 1,
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error("Failed to rehydrate app settings store:", error);
            return;
          }
          if (state) applyDarkModeStyles(state.ui.theme);
        };
      },
    },
  ),
);
