// --- Zustandストアのセレクタ利用例 ---
// 必要な値だけ取得することで再レンダリングを最適化できます。
// const showDate = useProgressSettingsStore((s) => s.showDate);
// 複数値をまとめて取得する場合は下記のように：
// const { showDate, showYear } = useProgressSettingsStore((s) => ({
//   showDate: s.showDate,
//   showYear: s.showYear,
// }));
// デフォルト値を一元管理
export const DEFAULT_PROGRESS_SETTINGS: Omit<
  ProgressSettingsState,
  | "setShowProgress"
  | "setProgressColor"
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
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ProgressColor,
  YearFormat,
  MonthFormat,
  DayFormat,
  WeekdayFormat,
} from "../types/progressSettings";

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
  // 背景画像設定
  showBackgroundImage: boolean;
  setShowBackgroundImage: (value: boolean) => void;
  backgroundImageFileName: string;
  setBackgroundImageFileName: (value: string) => void;
  backgroundFeatureEnabled: boolean;
  setBackgroundFeatureEnabled: (value: boolean) => void;
  // 汎用アップデート
  updateSettings: (values: Partial<Omit<ProgressSettingsState, "updateSettings">>) => void;
}

export const useProgressSettingsStore = create<ProgressSettingsState>()(
  persist(
    (set) => {
      const base = { ...DEFAULT_PROGRESS_SETTINGS };
      // setter自動生成
      const setters: Partial<ProgressSettingsState> = {};
      (Object.keys(base) as (keyof typeof base)[]).forEach((key) => {
        const setterName = "set" + key.charAt(0).toUpperCase() + key.slice(1);
        // @ts-expect-error 型安全性はinterfaceで担保
        setters[setterName] = (value: any) => set({ [key]: value });
      });
      return {
        ...base,
        ...setters,
        updateSettings: (values) => set(values),
      } as ProgressSettingsState;
    },
    {
      name: "progress-settings",
      version: 1,
      // 必要に応じて保存対象を限定したい場合は下記を有効化
      // partialize: (state) => ({
      //   showProgress: state.showProgress,
      //   progressColor: state.progressColor,
      //   ...
      // }),
      // ストア構造変更時のマイグレーション例
      migrate: (persistedState, _version) => {
        // 今後バージョンアップ時にここで変換処理を追加可能
        return persistedState;
      },
    }
  )
);
