import { useState, useEffect } from "react";
import { useClassSchedule } from "../../time/hooks/use-class-schedule";
import { Footer } from "~/components/footer/Footer";
import { SettingsButton } from "~/components/settings/SettingsButton";
import { SettingsPanel } from "~/components/settings/SettingsPanel";
import { useColorMode } from "~/hooks/use-color-mode";
import { useProgressSettings } from "~/hooks/use-progress-settings";

export function meta() {
  return [
    { title: "残り時間" },
    { name: "description", content: "授業までの残り時間を表示します。" },
  ];
}

export default function Time() {
  const [isClient, setIsClient] = useState(false);
  const status = useClassSchedule();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode, setMode, darkClass } = useColorMode();

  // クライアント側でのみ時間を表示するためのフラグ
  useEffect(() => {
    setIsClient(true);
  }, []);
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
  } = useProgressSettings();

  // 現在の日付を取得（日本語曜日付き）
  const getCurrentDate = () => {
    const now = new Date();
    let dateString = "";

    // 年表示
    if (showYear) {
      if (yearFormat === "reiwa") {
        const reiwaYear = now.getFullYear() - 2018; // 令和元年は2019年
        dateString += `令和${reiwaYear}年`;
      } else {
        dateString += `${now.getFullYear()}年`;
      }
    }

    // 月表示
    if (showMonth) {
      if (monthFormat === "japanese") {
        dateString += `${now.getMonth() + 1}月`;
      } else if (monthFormat === "english") {
        const monthNames = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        dateString += monthNames[now.getMonth()] + " ";
      } else if (monthFormat === "number") {
        dateString += String(now.getMonth() + 1).padStart(2, "0") + "/";
      }
    }

    // 日表示
    if (showDay) {
      if (dayFormat === "japanese") {
        dateString += `${now.getDate()}日`;
      } else {
        dateString += `${now.getDate()}`;
      }
    }

    // 曜日表示
    if (showWeekday) {
      const weekdays = {
        japanese: ["日", "月", "火", "水", "木", "金", "土"],
        short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      };
      const weekday = weekdays[weekdayFormat][now.getDay()];

      if (weekdayFormat === "japanese") {
        dateString += `（${weekday}）`;
      } else {
        dateString += ` ${weekday}`;
      }
    }

    return dateString.trim();
  };

  // 色に応じたクラス名
  const progressClass = {
    green: "progress-bright-green",
    blue: "progress-blue-500",
    yellow: "progress-yellow-400",
    pink: "progress-pink-500",
    purple: "progress-purple-500",
    sky: "progress-sky-400",
  }[progressColor];

  // 背景画像のスタイル
  const backgroundStyle = {
    backgroundImage: showBackgroundImage && backgroundImage ? `url(${backgroundImage})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

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
        />

        <div className="text-center select-none space-y-4">
          {/* 日付表示 */}
          {showDate && (
            <div className="text-lg font-medium text-base-content opacity-70">
              {getCurrentDate()}
            </div>
          )}

          {/* 次の時間割まで残り表示（クライアント側のみ） */}
          {isClient && status.timeRemaining && status.next && (
            <>
              {showRemainingText && (
                <div className="text-xl font-bold text-base-content opacity-80">
                  {status.next.label}まで残り
                </div>
              )}
              <div className="text-4xl font-mono font-bold text-primary">
                {status.timeRemaining}
              </div>
              {/* 進捗バー（クライアント側のみ） */}
              {isClient && showProgress && (
                <div className="w-80 max-w-full mx-auto mt-6">
                  <progress
                    className={`progress w-full h-3 ${progressClass}`}
                    value={
                      status.remainingMs
                        ? Math.max(0, 100 - (status.remainingMs / (50 * 60 * 1000)) * 100)
                        : 0
                    }
                    max="100"
                  ></progress>
                  <div className="text-xs opacity-60 mt-1">進捗</div>
                </div>
              )}
            </>
          )}

          {/* 現在進行中の場合（クライアント側のみ） */}
          {isClient && status.timeRemaining && !status.next && (
            <>
              {showRemainingText && (
                <div className="text-xl font-bold text-base-content opacity-80">
                  現在: {status.current?.label || "不明"}
                </div>
              )}
              <div className="text-4xl font-mono font-bold text-primary">
                {status.timeRemaining}
              </div>
              {/* 進捗バー（クライアント側のみ） */}
              {isClient && showProgress && (
                <div className="w-80 max-w-full mx-auto mt-6">
                  <progress
                    className={`progress w-full h-3 ${progressClass}`}
                    value={
                      status.remainingMs
                        ? Math.max(0, 100 - (status.remainingMs / (50 * 60 * 1000)) * 100)
                        : 0
                    }
                    max="100"
                  ></progress>
                  <div className="text-xs opacity-60 mt-1">進捗</div>
                </div>
              )}
            </>
          )}

          {/* 終了時（クライアント側のみ） */}
          {isClient && !status.timeRemaining && (
            <div className="text-3xl font-bold text-base-content">終了</div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
