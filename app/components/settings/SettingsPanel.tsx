import { useState } from "react";
import { COLORS } from "~/libs/utils";
import { DarkModeToggle } from "./DarkModeToggle";
import { ProgressBarSettings } from "./ProgressBarSettings";
import { BackgroundImageSettings } from "./BackgroundImageSettings";
import { ContactInfo } from "./ContactInfo";

// 設定項目の型定義
type ProgressColor = "blue" | "yellow" | "green" | "pink" | "purple" | "sky";
type YearFormat = "western" | "reiwa" | "2025" | "none";
type MonthFormat = "japanese" | "english" | "number" | "none";
type DayFormat = "japanese" | "number" | "english" | "none";
type WeekdayFormat = "short" | "long" | "japanese" | "none";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  mode: "dark" | "light";
  setMode: (v: "dark" | "light") => void;
  pageType?: string;

  // 進捗バー設定（timeページのみ）
  showProgress?: boolean;
  setShowProgress?: (v: boolean) => void;
  progressColor?: ProgressColor;
  setProgressColor?: (v: ProgressColor) => void;

  // 表示設定（timeページのみ）
  showRemainingText?: boolean;
  setShowRemainingText?: (v: boolean) => void;
  showCurrentSchedule?: boolean;
  setShowCurrentSchedule?: (v: boolean) => void;
  showDate?: boolean;
  setShowDate?: (v: boolean) => void;

  // 日付詳細設定（timeページのみ）
  showYear?: boolean;
  setShowYear?: (v: boolean) => void;
  showMonth?: boolean;
  setShowMonth?: (v: boolean) => void;
  showDay?: boolean;
  setShowDay?: (v: boolean) => void;
  showWeekday?: boolean;
  setShowWeekday?: (v: boolean) => void;
  yearFormat?: YearFormat;
  setYearFormat?: (v: YearFormat) => void;
  monthFormat?: MonthFormat;
  setMonthFormat?: (v: MonthFormat) => void;
  dayFormat?: DayFormat;
  setDayFormat?: (v: DayFormat) => void;
  weekdayFormat?: WeekdayFormat;
  setWeekdayFormat?: (v: WeekdayFormat) => void;

  // 背景画像設定（timeページのみ）
  backgroundImage?: string;
  setBackgroundImage?: (v: string) => Promise<void>;
  backgroundImageFileName?: string;
  showBackgroundImage?: boolean;
  setShowBackgroundImage?: (v: boolean) => void;

  // 隠し機能フラグ
  backgroundFeatureEnabled?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const {
    open,
    onClose,
    mode,
    setMode,
    pageType,
    // 進捗バー設定
    showProgress,
    setShowProgress,
    progressColor,
    setProgressColor,
    // 表示設定
    showRemainingText,
    setShowRemainingText,
    showCurrentSchedule,
    setShowCurrentSchedule,
    showDate,
    setShowDate,
    // 日付詳細設定
    showYear,
    setShowYear,
    showMonth,
    setShowMonth,
    showDay,
    setShowDay,
    showWeekday,
    setShowWeekday,
    yearFormat,
    setYearFormat,
    monthFormat,
    setMonthFormat,
    dayFormat,
    setDayFormat,
    weekdayFormat,
    setWeekdayFormat,
    // 背景画像設定
    backgroundImage,
    setBackgroundImage,
    backgroundImageFileName,
    showBackgroundImage,
    setShowBackgroundImage,
    // 隠し機能フラグ
    backgroundFeatureEnabled,
  } = props;

  const currentColors = COLORS[mode];
  const [activeTab, setActiveTab] = useState<"settings" | "advanced">("settings");

  // timeページかどうかの判定
  const isTimePage = pageType === "time";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 320,
        height: "100vh",
        zIndex: 100,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        className={`settings-panel h-full w-full flex flex-col p-6 relative ${mode}`}
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          boxShadow: open ? "-6px 0 24px #0002" : "none",
          background: currentColors.background,
          color: currentColors.text,
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 18,
            right: 16,
            background: "none",
            border: "none",
          }}
          className="text-xl block p-2 hover:bg-zinc-100/20 rounded transition"
          aria-label="閉じる"
        >
          ×
        </button>

        {/* タブボタン */}
        <div className="flex mb-6 border-b border-zinc-400/30">
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 font-semibold transition-colors duration-200 ${
              activeTab === "settings"
                ? "text-blue-500 border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            設定
          </button>
          {isTimePage && (
            <button
              onClick={() => setActiveTab("advanced")}
              className={`px-4 py-2 font-semibold transition-colors duration-200 ${
                activeTab === "advanced"
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              詳細設定
            </button>
          )}
        </div>

        {/* 設定タブの内容 */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-4">
            <DarkModeToggle mode={mode} setMode={setMode} />

            {/* 背景画像設定（timeページのみ、隠し機能が有効な場合のみ） */}
            {isTimePage &&
              backgroundFeatureEnabled &&
              showBackgroundImage !== undefined &&
              setShowBackgroundImage &&
              backgroundImage !== undefined &&
              setBackgroundImage && (
                <BackgroundImageSettings
                  mode={mode}
                  showBackgroundImage={showBackgroundImage}
                  setShowBackgroundImage={setShowBackgroundImage}
                  backgroundImage={backgroundImage}
                  setBackgroundImage={setBackgroundImage}
                  backgroundImageFileName={backgroundImageFileName || ""}
                />
              )}
          </div>
        )}
        {/* 詳細設定タブの内容（timeページのみ） */}
        {activeTab === "advanced" &&
          isTimePage &&
          showProgress !== undefined &&
          setShowProgress && (
            <ProgressBarSettings
              mode={mode}
              showProgress={showProgress}
              setShowProgress={setShowProgress}
              progressColor={progressColor!}
              setProgressColor={setProgressColor!}
              showRemainingText={showRemainingText!}
              setShowRemainingText={setShowRemainingText!}
              showCurrentSchedule={showCurrentSchedule!}
              setShowCurrentSchedule={setShowCurrentSchedule!}
              showDate={showDate!}
              setShowDate={setShowDate!}
              showYear={showYear!}
              setShowYear={setShowYear!}
              showMonth={showMonth!}
              setShowMonth={setShowMonth!}
              showDay={showDay!}
              setShowDay={setShowDay!}
              showWeekday={showWeekday!}
              setShowWeekday={setShowWeekday!}
              yearFormat={yearFormat!}
              setYearFormat={setYearFormat!}
              monthFormat={monthFormat!}
              setMonthFormat={setMonthFormat!}
              dayFormat={dayFormat!}
              setDayFormat={setDayFormat!}
              weekdayFormat={weekdayFormat!}
              setWeekdayFormat={setWeekdayFormat!}
              backgroundImage={backgroundImage!}
              setBackgroundImage={setBackgroundImage!}
            />
          )}

        <ContactInfo />
      </div>
    </div>
  );
};
