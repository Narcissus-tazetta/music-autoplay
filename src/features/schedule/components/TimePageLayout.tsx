import React, { useState, useEffect } from "react";
import { Footer } from "../../../shared/components/Footer";
import { SettingsButton } from "../../settings/components/SettingsButton";
import { SettingsPanel } from "../../settings/components/SettingsPanel";
import { DateDisplay } from "./DateDisplay";
import { TimeDisplay } from "./TimeDisplay";
import { useColorModeStore } from "../../settings/stores/colorModeStore";
import { useProgressSettings } from "../../settings/hooks/use-progress-settings";
import { useProgressSettingsStore } from "../../settings/stores/progressSettingsStore";
import { useClientOnly } from "../hooks/use-client-only";
import { createBackgroundStyle } from "../../../shared/utils/time/background-utils";

interface TimePageLayoutProps {
  status: {
    timeRemaining?: string;
    next?: { label: string } | null;
    current?: { label: string } | null;
    remainingMs?: number | null;
    totalDurationMs?: number;
  };
}

/**
 * 時間ページのメインレイアウトコンポーネント
 */
const TimePageLayout: React.FC<TimePageLayoutProps> = ({ status }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { mode, setMode, darkClass, hasHydrated } = useColorModeStore((s) => ({
    mode: s.mode,
    setMode: s.setMode,
    darkClass: s.darkClass,
    hasHydrated: s.hasHydrated,
  }));

  useEffect(() => {
    if (hasHydrated && typeof window !== "undefined") {
      const currentBodyClass = document.body.className;
      const expectedClass = mode;

      if (!currentBodyClass.includes(expectedClass)) {
        setMode(mode);
      }
    }
  }, [hasHydrated, mode, setMode]);

  const isClient = useClientOnly();

  const { backgroundImage, setBackgroundImage } = useProgressSettings();

  const progressSettings = useProgressSettingsStore((s) => ({
    showRemainingText: s.showRemainingText,
    setShowRemainingText: s.setShowRemainingText,
    showCurrentSchedule: s.showCurrentSchedule,
    setShowCurrentSchedule: s.setShowCurrentSchedule,
    showProgress: s.showProgress,
    setShowProgress: s.setShowProgress,
    progressColor: s.progressColor,
    setProgressColor: s.setProgressColor,
  }));

  const dateSettings = useProgressSettingsStore((s) => ({
    showDate: s.showDate,
    setShowDate: s.setShowDate,
    showYear: s.showYear,
    setShowYear: s.setShowYear,
    showMonth: s.showMonth,
    setShowMonth: s.setShowMonth,
    showDay: s.showDay,
    setShowDay: s.setShowDay,
    showWeekday: s.showWeekday,
    setShowWeekday: s.setShowWeekday,
    yearFormat: s.yearFormat,
    setYearFormat: s.setYearFormat,
    monthFormat: s.monthFormat,
    setMonthFormat: s.setMonthFormat,
    dayFormat: s.dayFormat,
    setDayFormat: s.setDayFormat,
    weekdayFormat: s.weekdayFormat,
    setWeekdayFormat: s.setWeekdayFormat,
  }));

  const backgroundSettings = useProgressSettingsStore((s) => ({
    showBackgroundImage: s.showBackgroundImage,
    setShowBackgroundImage: s.setShowBackgroundImage,
    backgroundImageFileName: s.backgroundImageFileName,
    backgroundFeatureEnabled: s.backgroundFeatureEnabled,
    setBackgroundFeatureEnabled: s.setBackgroundFeatureEnabled,
  }));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.shiftKey && event.key === " ") {
        event.preventDefault();
        backgroundSettings.setBackgroundFeatureEnabled(
          !backgroundSettings.backgroundFeatureEnabled
        );
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [backgroundSettings]);

  const backgroundStyle = createBackgroundStyle(
    backgroundSettings.showBackgroundImage,
    backgroundImage
  );

  return (
    <>
      <div
        className={`min-h-screen bg-base-200 flex items-center justify-center p-4 ${darkClass}`}
        style={backgroundStyle}
      >
        <SettingsButton onClick={() => setSettingsOpen(!settingsOpen)} />
        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          mode={mode}
          setMode={setMode}
          pageType="time"
          showProgress={progressSettings.showProgress}
          setShowProgress={progressSettings.setShowProgress}
          progressColor={progressSettings.progressColor}
          setProgressColor={progressSettings.setProgressColor}
          showRemainingText={progressSettings.showRemainingText}
          setShowRemainingText={progressSettings.setShowRemainingText}
          showCurrentSchedule={progressSettings.showCurrentSchedule}
          setShowCurrentSchedule={progressSettings.setShowCurrentSchedule}
          showDate={dateSettings.showDate}
          setShowDate={dateSettings.setShowDate}
          showYear={dateSettings.showYear}
          setShowYear={dateSettings.setShowYear}
          showMonth={dateSettings.showMonth}
          setShowMonth={dateSettings.setShowMonth}
          showDay={dateSettings.showDay}
          setShowDay={dateSettings.setShowDay}
          showWeekday={dateSettings.showWeekday}
          setShowWeekday={dateSettings.setShowWeekday}
          yearFormat={dateSettings.yearFormat}
          setYearFormat={dateSettings.setYearFormat}
          monthFormat={dateSettings.monthFormat}
          setMonthFormat={dateSettings.setMonthFormat}
          dayFormat={dateSettings.dayFormat}
          setDayFormat={dateSettings.setDayFormat}
          weekdayFormat={dateSettings.weekdayFormat}
          setWeekdayFormat={dateSettings.setWeekdayFormat}
          backgroundImage={backgroundImage}
          setBackgroundImage={setBackgroundImage}
          backgroundImageFileName={backgroundSettings.backgroundImageFileName}
          showBackgroundImage={backgroundSettings.showBackgroundImage}
          setShowBackgroundImage={backgroundSettings.setShowBackgroundImage}
          backgroundFeatureEnabled={backgroundSettings.backgroundFeatureEnabled}
        />

        <div className="text-center select-none space-y-4">
          <DateDisplay
            show={dateSettings.showDate}
            showYear={dateSettings.showYear}
            showMonth={dateSettings.showMonth}
            showDay={dateSettings.showDay}
            showWeekday={dateSettings.showWeekday}
            yearFormat={dateSettings.yearFormat}
            monthFormat={dateSettings.monthFormat}
            dayFormat={dateSettings.dayFormat}
            weekdayFormat={dateSettings.weekdayFormat}
          />

          {/* 時間表示 */}
          <TimeDisplay
            isClient={isClient}
            timeRemaining={status.timeRemaining}
            next={status.next}
            current={status.current}
            remainingMs={status.remainingMs}
            totalDurationMs={status.totalDurationMs}
            showRemainingText={progressSettings.showRemainingText}
            showCurrentSchedule={progressSettings.showCurrentSchedule}
            showProgress={progressSettings.showProgress}
            progressColor={progressSettings.progressColor}
          />
        </div>
      </div>

      <Footer />
    </>
  );
};

export default TimePageLayout;
