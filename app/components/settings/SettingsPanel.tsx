import { useState } from "react";
import { COLORS } from "~/libs/utils";
import { DarkModeToggle } from "./DarkModeToggle";
import { ProgressBarSettings } from "./ProgressBarSettings";
import { ContactInfo } from "./ContactInfo";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  mode: "dark" | "light";
  setMode: (v: "dark" | "light") => void;
  pageType?: string;
  showProgress?: boolean;
  setShowProgress?: (v: boolean) => void;
  progressColor?: "blue" | "yellow" | "green" | "pink" | "purple" | "sky";
  setProgressColor?: (v: "blue" | "yellow" | "green" | "pink" | "purple" | "sky") => void;
  showRemainingText?: boolean;
  setShowRemainingText?: (v: boolean) => void;
  showDate?: boolean;
  setShowDate?: (v: boolean) => void;
  // 日付コンポーネント設定
  showYear?: boolean;
  setShowYear?: (v: boolean) => void;
  showMonth?: boolean;
  setShowMonth?: (v: boolean) => void;
  showDay?: boolean;
  setShowDay?: (v: boolean) => void;
  showWeekday?: boolean;
  setShowWeekday?: (v: boolean) => void;
  yearFormat?: "western" | "reiwa";
  setYearFormat?: (v: "western" | "reiwa") => void;
  monthFormat?: "japanese" | "english" | "number";
  setMonthFormat?: (v: "japanese" | "english" | "number") => void;
  dayFormat?: "japanese" | "number";
  setDayFormat?: (v: "japanese" | "number") => void;
  weekdayFormat?: "short" | "long" | "japanese";
  setWeekdayFormat?: (v: "short" | "long" | "japanese") => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = (props) => {
  const {
    open,
    onClose,
    mode,
    setMode,
    pageType,
    showProgress: showProgressProp,
    setShowProgress: setShowProgressProp,
    progressColor: progressColorProp,
    setProgressColor: setProgressColorProp,
    showRemainingText: showRemainingTextProp,
    setShowRemainingText: setShowRemainingTextProp,
    showDate: showDateProp,
    setShowDate: setShowDateProp,
    // 日付コンポーネント設定
    showYear: showYearProp,
    setShowYear: setShowYearProp,
    showMonth: showMonthProp,
    setShowMonth: setShowMonthProp,
    showDay: showDayProp,
    setShowDay: setShowDayProp,
    showWeekday: showWeekdayProp,
    setShowWeekday: setShowWeekdayProp,
    yearFormat: yearFormatProp,
    setYearFormat: setYearFormatProp,
    monthFormat: monthFormatProp,
    setMonthFormat: setMonthFormatProp,
    dayFormat: dayFormatProp,
    setDayFormat: setDayFormatProp,
    weekdayFormat: weekdayFormatProp,
    setWeekdayFormat: setWeekdayFormatProp,
  } = props;
  const currentColors = COLORS[mode];
  const [activeTab, setActiveTab] = useState<"settings" | "advanced">("settings");

  // showProgress, progressColor, setShowProgress, setProgressColorはpropsから受け取る
  // fallbackは内部state（ただし/timeでは必ずpropsが渡る想定）
  const [internalShowProgress, internalSetShowProgress] = useState(true);
  const [internalProgressColor, internalSetProgressColor] = useState<
    "blue" | "yellow" | "green" | "pink" | "purple" | "sky"
  >("green");
  const [internalShowRemainingText, internalSetShowRemainingText] = useState(true);
  const [internalShowDate, internalSetShowDate] = useState(false);

  // 日付コンポーネント用の内部state
  const [internalShowYear, internalSetShowYear] = useState(true);
  const [internalShowMonth, internalSetShowMonth] = useState(true);
  const [internalShowDay, internalSetShowDay] = useState(true);
  const [internalShowWeekday, internalSetShowWeekday] = useState(true);
  const [internalYearFormat, internalSetYearFormat] = useState<"western" | "reiwa">("western");
  const [internalMonthFormat, internalSetMonthFormat] = useState<"japanese" | "english" | "number">(
    "japanese"
  );
  const [internalDayFormat, internalSetDayFormat] = useState<"japanese" | "number">("japanese");
  const [internalWeekdayFormat, internalSetWeekdayFormat] = useState<"short" | "long" | "japanese">(
    "short"
  );

  const showProgress =
    typeof showProgressProp === "boolean" ? showProgressProp : internalShowProgress;
  const setShowProgress = setShowProgressProp || internalSetShowProgress;
  const progressColor = progressColorProp || internalProgressColor;
  const setProgressColor = setProgressColorProp || internalSetProgressColor;
  const showRemainingText =
    typeof showRemainingTextProp === "boolean" ? showRemainingTextProp : internalShowRemainingText;
  const setShowRemainingText = setShowRemainingTextProp || internalSetShowRemainingText;
  const showDate = typeof showDateProp === "boolean" ? showDateProp : internalShowDate;
  const setShowDate = setShowDateProp || internalSetShowDate;

  // 日付コンポーネント設定
  const showYear = typeof showYearProp === "boolean" ? showYearProp : internalShowYear;
  const setShowYear = setShowYearProp || internalSetShowYear;
  const showMonth = typeof showMonthProp === "boolean" ? showMonthProp : internalShowMonth;
  const setShowMonth = setShowMonthProp || internalSetShowMonth;
  const showDay = typeof showDayProp === "boolean" ? showDayProp : internalShowDay;
  const setShowDay = setShowDayProp || internalSetShowDay;
  const showWeekday = typeof showWeekdayProp === "boolean" ? showWeekdayProp : internalShowWeekday;
  const setShowWeekday = setShowWeekdayProp || internalSetShowWeekday;
  const yearFormat = yearFormatProp || internalYearFormat;
  const setYearFormat = setYearFormatProp || internalSetYearFormat;
  const monthFormat = monthFormatProp || internalMonthFormat;
  const setMonthFormat = setMonthFormatProp || internalSetMonthFormat;
  const dayFormat = dayFormatProp || internalDayFormat;
  const setDayFormat = setDayFormatProp || internalSetDayFormat;
  const weekdayFormat = weekdayFormatProp || internalWeekdayFormat;
  const setWeekdayFormat = setWeekdayFormatProp || internalSetWeekdayFormat;
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
          {pageType === "time" && (
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
          </div>
        )}

        {/* 詳細設定タブの内容（/timeページでのみ表示） */}
        {activeTab === "advanced" && pageType === "time" && (
          <ProgressBarSettings
            mode={mode}
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
          />
        )}

        <ContactInfo />
      </div>
    </div>
  );
};
