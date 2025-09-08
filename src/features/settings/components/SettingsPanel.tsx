/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
              setBackgroundImage={(str) => {
                setBackgroundImage?.(str).catch((err: unknown) => {
                  console.error(err);
                });
              }}
            />
          )}

        <ContactInfo />
      </div>
    </div>
  );
};
