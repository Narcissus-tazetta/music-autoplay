import { useState } from "react";
import { Footer } from "~/components/footer/Footer";
import { SettingsButton } from "~/components/settings/SettingsButton";
import { SettingsPanel } from "~/components/settings/SettingsPanel";
import { DateDisplay } from "./DateDisplay";
import { TimeDisplay } from "./TimeDisplay";
import { useColorMode } from "~/hooks/use-color-mode";
import { useProgressSettings } from "~/hooks/use-progress-settings";
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
export function TimePageLayout({ status }: TimePageLayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, darkClass } = useColorMode();
  const isClient = useClientOnly();

  // プログレスバー設定を永続化対応のカスタムフックで管理
  const {
    showProgress,
    setShowProgress,
    progressColor,
    setProgressColor,
    showRemainingText,
    setShowRemainingText,
    showDate,
    setShowDate,
    // 日付コンポーネント設定
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
  } = useProgressSettings();

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
            showProgress={showProgress}
            progressColor={progressColor}
          />
        </div>
      </div>

      <Footer />
    </>
  );
}
