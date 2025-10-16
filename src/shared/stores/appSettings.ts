import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DayFormat,
  MonthFormat,
  ProgressColor,
  WeekdayFormat,
  YearFormat,
} from "../types/progressSettings";

interface UISettings {
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
  updateUI: (values: Partial<UISettings>) => void;
  updateProgress: (values: Partial<ProgressSettings>) => void;
}

const DEFAULT_UI_SETTINGS: UISettings = {
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

export const useAppSettings = create<AppSettingsState>()(
  persist(
    (set) => ({
      ui: DEFAULT_UI_SETTINGS,
      progress: DEFAULT_PROGRESS_SETTINGS,

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
    }),
    {
      name: "app-settings-storage",
      version: 2,
    },
  ),
);
