import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ProgressColor,
  YearFormat,
  MonthFormat,
  DayFormat,
  WeekdayFormat,
} from "../../../shared/types/progressSettings";

export const DEFAULT_PROGRESS_SETTINGS: Omit<
  ProgressSettingsState,
  | "setShowProgress"
  | "setProgressColor"
  | "setShowRemainingText"
  | "setShowCurrentSchedule"
  | "setShowDate"
  | "setShowYear"
  | "setShowMonth"
  | "setShowDay"
  | "setShowWeekday"
  | "setYearFormat"
  | "setMonthFormat"
  | "setDayFormat"
  | "setWeekdayFormat"
  | "setShowBackgroundImage"
  | "setBackgroundImageFileName"
  | "setBackgroundFeatureEnabled"
  | "updateSettings"
> = {
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

interface ProgressSettingsState {
  showProgress: boolean;
  setShowProgress: (value: boolean) => void;
  progressColor: ProgressColor;
  setProgressColor: (color: ProgressColor) => void;
  showRemainingText: boolean;
  setShowRemainingText: (value: boolean) => void;
  showCurrentSchedule: boolean;
  setShowCurrentSchedule: (value: boolean) => void;
  showDate: boolean;
  setShowDate: (value: boolean) => void;
  showYear: boolean;
  setShowYear: (value: boolean) => void;
  showMonth: boolean;
  setShowMonth: (value: boolean) => void;
  showDay: boolean;
  setShowDay: (value: boolean) => void;
  showWeekday: boolean;
  setShowWeekday: (value: boolean) => void;
  yearFormat: YearFormat;
  setYearFormat: (value: YearFormat) => void;
  monthFormat: MonthFormat;
  setMonthFormat: (value: MonthFormat) => void;
  dayFormat: DayFormat;
  setDayFormat: (value: DayFormat) => void;
  weekdayFormat: WeekdayFormat;
  setWeekdayFormat: (value: WeekdayFormat) => void;
  showBackgroundImage: boolean;
  setShowBackgroundImage: (value: boolean) => void;
  backgroundImageFileName: string;
  setBackgroundImageFileName: (value: string) => void;
  backgroundFeatureEnabled: boolean;
  setBackgroundFeatureEnabled: (value: boolean) => void;
  updateSettings: (values: Partial<Omit<ProgressSettingsState, "updateSettings">>) => void;
}

export const useProgressSettingsStore = create<ProgressSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PROGRESS_SETTINGS,

      setShowProgress: (value: boolean) => set({ showProgress: value }),
      setProgressColor: (color: ProgressColor) => set({ progressColor: color }),
      setShowRemainingText: (value: boolean) => set({ showRemainingText: value }),
      setShowCurrentSchedule: (value: boolean) => set({ showCurrentSchedule: value }),

      setShowDate: (value: boolean) => set({ showDate: value }),
      setShowYear: (value: boolean) => set({ showYear: value }),
      setShowMonth: (value: boolean) => set({ showMonth: value }),
      setShowDay: (value: boolean) => set({ showDay: value }),
      setShowWeekday: (value: boolean) => set({ showWeekday: value }),
      setYearFormat: (value: YearFormat) => set({ yearFormat: value }),
      setMonthFormat: (value: MonthFormat) => set({ monthFormat: value }),
      setDayFormat: (value: DayFormat) => set({ dayFormat: value }),
      setWeekdayFormat: (value: WeekdayFormat) => set({ weekdayFormat: value }),

      setShowBackgroundImage: (value: boolean) => set({ showBackgroundImage: value }),
      setBackgroundImageFileName: (value: string) => set({ backgroundImageFileName: value }),
      setBackgroundFeatureEnabled: (value: boolean) => set({ backgroundFeatureEnabled: value }),

      updateSettings: (values) => set(values),
    }),
    {
      name: "progress-settings",
      version: 1,
      migrate: (persistedState, _version) => {
        return persistedState;
      },
    }
  )
);
