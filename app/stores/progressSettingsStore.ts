import { create } from "zustand";
import { persist } from "zustand/middleware";

type ProgressColor = "blue" | "yellow" | "green" | "pink" | "purple" | "sky";
type YearFormat = "western" | "reiwa" | "2025" | "none";
type MonthFormat = "japanese" | "english" | "number" | "none";
type DayFormat = "japanese" | "number" | "english" | "none";
type WeekdayFormat = "short" | "long" | "japanese" | "none";

interface ProgressSettingsState {
  showProgress: boolean;
  setShowProgress: (value: boolean) => void;
  progressColor: ProgressColor;
  setProgressColor: (color: ProgressColor) => void;
  // 日付表示設定
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
}

export const useProgressSettingsStore = create<ProgressSettingsState>()(
  persist(
    (set) => ({
      showProgress: true,
      setShowProgress: (value) => set({ showProgress: value }),
      progressColor: "green",
      setProgressColor: (color) => set({ progressColor: color }),
      // 日付表示設定
      showDate: false,
      setShowDate: (value) => set({ showDate: value }),
      showYear: true,
      setShowYear: (value) => set({ showYear: value }),
      showMonth: true,
      setShowMonth: (value) => set({ showMonth: value }),
      showDay: true,
      setShowDay: (value) => set({ showDay: value }),
      showWeekday: true,
      setShowWeekday: (value) => set({ showWeekday: value }),
      yearFormat: "western",
      setYearFormat: (value) => set({ yearFormat: value }),
      monthFormat: "japanese",
      setMonthFormat: (value) => set({ monthFormat: value }),
      dayFormat: "japanese",
      setDayFormat: (value) => set({ dayFormat: value }),
      weekdayFormat: "short",
      setWeekdayFormat: (value) => set({ weekdayFormat: value }),
    }),
    {
      name: "progress-settings",
    }
  )
);
