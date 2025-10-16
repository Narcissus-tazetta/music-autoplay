import { useState } from "react";
import { BackgroundImageSettings } from "./BackgroundImageSettings";
import { ContactInfo } from "./ContactInfo";
import { DarkModeToggle } from "./DarkModeToggle";
import { ProgressBarSettings } from "./ProgressBarSettings";

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

  showProgress?: boolean;
  setShowProgress?: (v: boolean) => void;
  progressColor?: ProgressColor;
  setProgressColor?: (v: ProgressColor) => void;

  showRemainingText?: boolean;
  setShowRemainingText?: (v: boolean) => void;
  showCurrentSchedule?: boolean;
  setShowCurrentSchedule?: (v: boolean) => void;
  showDate?: boolean;
  setShowDate?: (v: boolean) => void;

  ytStatusVisible?: boolean;
  setYtStatusVisible?: (v: boolean) => void;

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

  backgroundImage?: string;
  setBackgroundImage?: (v: string) => Promise<void>;
  backgroundImageFileName?: string;
  showBackgroundImage?: boolean;
  setShowBackgroundImage?: (v: boolean) => void;

  backgroundFeatureEnabled?: boolean;
}

export const SettingsPanel = ({
  open,
  onClose,
  mode,
  setMode,
  pageType,
  showProgress,
  setShowProgress,
  progressColor,
  setProgressColor,
  showRemainingText,
  setShowRemainingText,
  showCurrentSchedule,
  setShowCurrentSchedule,
  showDate,
  setShowDate,
  ytStatusVisible,
  setYtStatusVisible,
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
  backgroundImage,
  setBackgroundImage,
  backgroundImageFileName,
  showBackgroundImage,
  setShowBackgroundImage,
  backgroundFeatureEnabled,
}: SettingsPanelProps) => {
  const currentColors = {
    background: "var(--color-bg, #fff)",
    text: "var(--color-fg, #212225)",
  };
  const [activeTab, setActiveTab] = useState<"settings" | "advanced">(
    "settings",
  );

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
          transition:
            "var(--transition-colors, background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)), transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out",
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
          className="text-xl block p-2 hover:bg-zinc-100/20 rounded transition-all duration-200 ease-in-out"
          aria-label="閉じる"
        >
          ×
        </button>

        <div className="flex mb-6 border-b border-zinc-400/30">
          <button
            onClick={() => {
              setActiveTab("settings");
            }}
            className={`px-4 py-2 font-semibold transition-all 0.2s cubic-bezier(0.4,0,0.2,1) ${
              activeTab === "settings"
                ? "text-blue-500 dark:text-purple-400 border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            設定
          </button>
          {isTimePage && (
            <button
              onClick={() => {
                setActiveTab("advanced");
              }}
              className={`px-4 py-2 font-semibold transition-all 0.2s cubic-bezier(0.4,0,0.2,1) ${
                activeTab === "advanced"
                  ? "text-blue-500 dark:text-purple-400 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              詳細設定
            </button>
          )}
        </div>

        {activeTab === "settings" && (
          <div className="flex flex-col gap-4">
            <DarkModeToggle mode={mode} setMode={setMode} />

            {isTimePage &&
              typeof ytStatusVisible === "boolean" &&
              typeof setYtStatusVisible === "function" && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ytStatusVisible}
                    onChange={(e) => {
                      setYtStatusVisible(e.target.checked);
                    }}
                    id="ytStatusVisible"
                    className="w-4 h-4"
                  />
                  <label htmlFor="ytStatusVisible" className="cursor-pointer">
                    YouTube再生状況を表示
                  </label>
                </div>
              )}

            {isTimePage &&
              backgroundFeatureEnabled &&
              typeof showBackgroundImage === "boolean" &&
              typeof setShowBackgroundImage === "function" &&
              backgroundImage !== undefined &&
              typeof setBackgroundImage === "function" && (
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
        {activeTab === "advanced" &&
          isTimePage &&
          typeof showProgress === "boolean" &&
          typeof setShowProgress === "function" &&
          (() => {
            // Build safe defaults/wrappers for optional props used by ProgressBarSettings
            const safeProgressColor: ProgressColor = progressColor ?? "blue";
            const safeSetProgressColor =
              typeof setProgressColor === "function"
                ? setProgressColor
                : () => {};

            const safeShowRemainingText = Boolean(showRemainingText);
            const safeSetShowRemainingText =
              typeof setShowRemainingText === "function"
                ? setShowRemainingText
                : () => {};

            const safeShowCurrentSchedule = Boolean(showCurrentSchedule);
            const safeSetShowCurrentSchedule =
              typeof setShowCurrentSchedule === "function"
                ? setShowCurrentSchedule
                : () => {};

            const safeShowDate = Boolean(showDate);
            const safeSetShowDate =
              typeof setShowDate === "function" ? setShowDate : () => {};

            const safeShowYear = Boolean(showYear);
            const safeSetShowYear =
              typeof setShowYear === "function" ? setShowYear : () => {};

            const safeShowMonth = Boolean(showMonth);
            const safeSetShowMonth =
              typeof setShowMonth === "function" ? setShowMonth : () => {};

            const safeShowDay = Boolean(showDay);
            const safeSetShowDay =
              typeof setShowDay === "function" ? setShowDay : () => {};

            const safeShowWeekday = Boolean(showWeekday);
            const safeSetShowWeekday =
              typeof setShowWeekday === "function" ? setShowWeekday : () => {};

            const safeYearFormat: YearFormat = yearFormat ?? "western";
            const safeSetYearFormat =
              typeof setYearFormat === "function" ? setYearFormat : () => {};

            const safeMonthFormat: MonthFormat = monthFormat ?? "japanese";
            const safeSetMonthFormat =
              typeof setMonthFormat === "function" ? setMonthFormat : () => {};

            const safeDayFormat: DayFormat = dayFormat ?? "japanese";
            const safeSetDayFormat =
              typeof setDayFormat === "function" ? setDayFormat : () => {};

            const safeWeekdayFormat: WeekdayFormat =
              weekdayFormat ?? "japanese";
            const safeSetWeekdayFormat =
              typeof setWeekdayFormat === "function"
                ? setWeekdayFormat
                : () => {};

            const safeBackgroundImage = backgroundImage ?? "";
            const safeSetBackgroundImage =
              typeof setBackgroundImage === "function"
                ? (str: string) => {
                    // ensure promise rejection is handled
                    try {
                      const maybe = setBackgroundImage(str);
                      // Normalize to a Promise so we can safely attach a catch handler
                      Promise.resolve(maybe).catch((err: unknown) => {
                        console.error(err);
                      });
                    } catch (err: unknown) {
                      console.error(err);
                    }
                  }
                : () => {};

            return (
              <ProgressBarSettings
                mode={mode}
                showProgress={showProgress}
                setShowProgress={setShowProgress}
                progressColor={safeProgressColor}
                setProgressColor={safeSetProgressColor}
                showRemainingText={safeShowRemainingText}
                setShowRemainingText={safeSetShowRemainingText}
                showCurrentSchedule={safeShowCurrentSchedule}
                setShowCurrentSchedule={safeSetShowCurrentSchedule}
                showDate={safeShowDate}
                setShowDate={safeSetShowDate}
                showYear={safeShowYear}
                setShowYear={safeSetShowYear}
                showMonth={safeShowMonth}
                setShowMonth={safeSetShowMonth}
                showDay={safeShowDay}
                setShowDay={safeSetShowDay}
                showWeekday={safeShowWeekday}
                setShowWeekday={safeSetShowWeekday}
                yearFormat={safeYearFormat}
                setYearFormat={safeSetYearFormat}
                monthFormat={safeMonthFormat}
                setMonthFormat={safeSetMonthFormat}
                dayFormat={safeDayFormat}
                setDayFormat={safeSetDayFormat}
                weekdayFormat={safeWeekdayFormat}
                setWeekdayFormat={safeSetWeekdayFormat}
                backgroundImage={safeBackgroundImage}
                setBackgroundImage={safeSetBackgroundImage}
              />
            );
          })()}

        <ContactInfo />
      </div>
    </div>
  );
};
