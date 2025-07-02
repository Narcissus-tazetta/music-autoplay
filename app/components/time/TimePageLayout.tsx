import React, { useState, useEffect } from "react";
import { Footer } from "~/components/footer/Footer";
import { SettingsButton } from "~/components/settings/SettingsButton";
import { SettingsPanel } from "~/components/settings/SettingsPanel";
import { DateDisplay } from "./DateDisplay";
import { TimeDisplay } from "./TimeDisplay";
import { useColorMode } from "~/hooks/use-color-mode";
import { useProgressSettings } from "~/hooks/use-progress-settings";
import { useProgressSettingsStore } from "~/stores/progressSettingsStore";
import { useClientOnly } from "~/hooks/time/use-client-only";
import { createBackgroundStyle } from "~/utils/time/background-utils";

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
  const { mode, setMode, darkClass } = useColorMode();
  const isClient = useClientOnly();

  // 背景画像のみカスタムフックから（IndexedDB用）
  const { backgroundImage, setBackgroundImage } = useProgressSettings();

  // 全ての設定をZustandストアから取得
  const showRemainingText = useProgressSettingsStore((s) => s.showRemainingText);
  const setShowRemainingText = useProgressSettingsStore((s) => s.setShowRemainingText);
  const showCurrentSchedule = useProgressSettingsStore((s) => s.showCurrentSchedule);
  const setShowCurrentSchedule = useProgressSettingsStore((s) => s.setShowCurrentSchedule);
  const showDate = useProgressSettingsStore((s) => s.showDate);
  const setShowDate = useProgressSettingsStore((s) => s.setShowDate);
  const showYear = useProgressSettingsStore((s) => s.showYear);
  const setShowYear = useProgressSettingsStore((s) => s.setShowYear);
  const showMonth = useProgressSettingsStore((s) => s.showMonth);
  const setShowMonth = useProgressSettingsStore((s) => s.setShowMonth);
  const showDay = useProgressSettingsStore((s) => s.showDay);
  const setShowDay = useProgressSettingsStore((s) => s.setShowDay);
  const showWeekday = useProgressSettingsStore((s) => s.showWeekday);
  const setShowWeekday = useProgressSettingsStore((s) => s.setShowWeekday);
  const yearFormat = useProgressSettingsStore((s) => s.yearFormat);
  const setYearFormat = useProgressSettingsStore((s) => s.setYearFormat);
  const monthFormat = useProgressSettingsStore((s) => s.monthFormat);
  const setMonthFormat = useProgressSettingsStore((s) => s.setMonthFormat);
  const dayFormat = useProgressSettingsStore((s) => s.dayFormat);
  const setDayFormat = useProgressSettingsStore((s) => s.setDayFormat);
  const weekdayFormat = useProgressSettingsStore((s) => s.weekdayFormat);
  const setWeekdayFormat = useProgressSettingsStore((s) => s.setWeekdayFormat);

  // 背景画像設定はZustandストアから取得
  const showBackgroundImage = useProgressSettingsStore((s) => s.showBackgroundImage);
  const setShowBackgroundImage = useProgressSettingsStore((s) => s.setShowBackgroundImage);
  const backgroundImageFileName = useProgressSettingsStore((s) => s.backgroundImageFileName);
  const backgroundFeatureEnabled = useProgressSettingsStore((s) => s.backgroundFeatureEnabled);
  const setBackgroundFeatureEnabled = useProgressSettingsStore(
    (s) => s.setBackgroundFeatureEnabled
  );

  // showProgress, progressColorはZustandストアから取得
  const showProgress = useProgressSettingsStore((s) => s.showProgress);
  const progressColor = useProgressSettingsStore((s) => s.progressColor);
  const setProgressColor = useProgressSettingsStore((s) => s.setProgressColor);
  const setShowProgress = useProgressSettingsStore((s) => s.setShowProgress);

  // Cmd+Shift+Space で背景画像機能トグル
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.shiftKey && event.key === " ") {
        event.preventDefault();
        setBackgroundFeatureEnabled(!backgroundFeatureEnabled);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [backgroundFeatureEnabled, setBackgroundFeatureEnabled]);

  // 背景画像のスタイル
  const backgroundStyle = createBackgroundStyle(showBackgroundImage, backgroundImage);

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
          showProgress={showProgress}
          setShowProgress={setShowProgress}
          progressColor={progressColor}
          setProgressColor={setProgressColor}
          showRemainingText={showRemainingText}
          setShowRemainingText={setShowRemainingText}
          showCurrentSchedule={showCurrentSchedule}
          setShowCurrentSchedule={setShowCurrentSchedule}
          showDate={showDate}
          setShowDate={setShowDate}
          showYear={showYear}
          setShowYear={setShowYear}
          showMonth={showMonth}
          setShowMonth={setShowMonth}
          showDay={showDay}
          setShowDay={setShowDay}
          showWeekday={showWeekday}
          setShowWeekday={setShowWeekday}
          yearFormat={yearFormat}
          setYearFormat={setYearFormat}
          monthFormat={monthFormat}
          setMonthFormat={setMonthFormat}
          dayFormat={dayFormat}
          setDayFormat={setDayFormat}
          weekdayFormat={weekdayFormat}
          setWeekdayFormat={setWeekdayFormat}
          backgroundImage={backgroundImage}
          setBackgroundImage={setBackgroundImage}
          backgroundImageFileName={backgroundImageFileName}
          showBackgroundImage={showBackgroundImage}
          setShowBackgroundImage={setShowBackgroundImage}
          backgroundFeatureEnabled={backgroundFeatureEnabled}
        />

        <div className="text-center select-none space-y-4">
          {/* 日付表示 */}
          <DateDisplay
            show={showDate}
            showYear={showYear}
            showMonth={showMonth}
            showDay={showDay}
            showWeekday={showWeekday}
            yearFormat={yearFormat}
            monthFormat={monthFormat}
            dayFormat={dayFormat}
            weekdayFormat={weekdayFormat}
          />

          {/* 時間表示 */}
          <TimeDisplay
            isClient={isClient}
            timeRemaining={status.timeRemaining}
            next={status.next}
            current={status.current}
            remainingMs={status.remainingMs}
            totalDurationMs={status.totalDurationMs}
            showRemainingText={showRemainingText}
            showCurrentSchedule={showCurrentSchedule}
            showProgress={showProgress}
            progressColor={progressColor}
          />
        </div>
      </div>

      <Footer />
    </>
  );
};

export default TimePageLayout;
