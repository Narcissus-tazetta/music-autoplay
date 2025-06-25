type ProgressColor = "blue" | "yellow" | "green" | "pink" | "purple" | "sky";
type YearFormat = "western" | "reiwa" | "2025" | "none";
type MonthFormat = "japanese" | "english" | "number" | "none";
type DayFormat = "japanese" | "number" | "english" | "none";
type WeekdayFormat = "short" | "long" | "japanese" | "none";

interface ProgressBarSettingsProps {
  mode: "dark" | "light";
  showProgress: boolean;
  setShowProgress: (v: boolean) => void;
  progressColor: ProgressColor;
  setProgressColor: (v: ProgressColor) => void;
  showRemainingText: boolean;
  setShowRemainingText: (v: boolean) => void;
  showCurrentSchedule: boolean;
  setShowCurrentSchedule: (v: boolean) => void;
  showDate: boolean;
  setShowDate: (v: boolean) => void;
  // 日付コンポーネント設定
  showYear: boolean;
  setShowYear: (v: boolean) => void;
  showMonth: boolean;
  setShowMonth: (v: boolean) => void;
  showDay: boolean;
  setShowDay: (v: boolean) => void;
  showWeekday: boolean;
  setShowWeekday: (v: boolean) => void;
  yearFormat: YearFormat;
  setYearFormat: (v: YearFormat) => void;
  monthFormat: MonthFormat;
  setMonthFormat: (v: MonthFormat) => void;
  dayFormat: DayFormat;
  setDayFormat: (v: DayFormat) => void;
  weekdayFormat: WeekdayFormat;
  setWeekdayFormat: (v: WeekdayFormat) => void;
  // 背景画像設定
  backgroundImage: string;
  setBackgroundImage: (v: string) => void;
}

export const ProgressBarSettings: React.FC<ProgressBarSettingsProps> = ({
  mode,
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
  backgroundImage: _backgroundImage,
  setBackgroundImage: _setBackgroundImage,
}) => {
  // 現在の日付情報を取得
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const reiwaYear = currentYear - 2018;

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

  const weekdays = {
    japanese: ["日", "月", "火", "水", "木", "金", "土"],
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  };
  const currentWeekday = now.getDay();

  // 英語の序数詞のサフィックスを取得
  const getOrdinalSuffix = (day: number): string => {
    if (day >= 11 && day <= 13) {
      return "th";
    }
    const lastDigit = day % 10;
    switch (lastDigit) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 日付表示設定 */}
      <label
        className={`flex items-center justify-between cursor-pointer py-2 ${mode === "dark" ? "text-white" : "text-black"}`}
      >
        <span className="block font-medium">日付表示</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={showDate}
          onChange={(e) => setShowDate(e.target.checked)}
        />
      </label>

      {/* 日付詳細設定（日付表示がONの場合のみ） */}
      {showDate && (
        <div className="ml-4 flex flex-col gap-3 p-3 border rounded-lg border-gray-200 dark:border-gray-700">
          <h4
            className={`font-medium text-sm ${mode === "dark" ? "text-gray-300" : "text-gray-700"}`}
          >
            日付表示の詳細設定
          </h4>

          {/* 年表示 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-primary scale-75"
                checked={showYear}
                onChange={(e) => setShowYear(e.target.checked)}
              />
              <span className={`text-sm ${mode === "dark" ? "text-white" : "text-black"}`}>
                年表示
              </span>
            </div>
            {showYear && (
              <select
                value={yearFormat}
                onChange={(e) => setYearFormat(e.target.value as YearFormat)}
                className="select select-sm select-bordered max-w-xs text-right"
              >
                <option value="western">{currentYear}年</option>
                <option value="reiwa">令和{reiwaYear}年</option>
                <option value="2025">{currentYear}</option>
                <option value="none">非表示</option>
              </select>
            )}
          </div>

          {/* 月表示 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-primary scale-75"
                checked={showMonth}
                onChange={(e) => setShowMonth(e.target.checked)}
              />
              <span className={`text-sm ${mode === "dark" ? "text-white" : "text-black"}`}>
                月表示
              </span>
            </div>
            {showMonth && (
              <select
                value={monthFormat}
                onChange={(e) => setMonthFormat(e.target.value as MonthFormat)}
                className="select select-sm select-bordered max-w-xs text-right"
              >
                <option value="japanese">{currentMonth}月</option>
                <option value="english">{monthNames[now.getMonth()]}</option>
                <option value="number">{String(currentMonth).padStart(2, "0")}</option>
                <option value="none">非表示</option>
              </select>
            )}
          </div>

          {/* 日表示 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="toggle toggle-primary scale-75"
                checked={showDay}
                onChange={(e) => setShowDay(e.target.checked)}
              />
              <span className={`text-sm ${mode === "dark" ? "text-white" : "text-black"}`}>
                日表示
              </span>
            </div>
            {showDay && (
              <select
                value={dayFormat}
                onChange={(e) => setDayFormat(e.target.value as DayFormat)}
                className="select select-sm select-bordered max-w-xs text-right"
              >
                <option value="japanese">{currentDay}日</option>
                <option value="number">{currentDay}</option>
                <option value="english">
                  {currentDay}
                  {getOrdinalSuffix(currentDay)}
                </option>
                <option value="none">非表示</option>
              </select>
            )}
          </div>

          {/* 曜日表示 */}
          <div className="w-full flex items-center gap-2">
            <input
              type="checkbox"
              className="toggle toggle-primary scale-75"
              checked={showWeekday}
              onChange={(e) => setShowWeekday(e.target.checked)}
            />
            <span
              className={`text-sm whitespace-nowrap ${mode === "dark" ? "text-white" : "text-black"}`}
            >
              曜日表示
            </span>
            <div className="flex-1"></div>
            {showWeekday && (
              <select
                value={weekdayFormat}
                onChange={(e) => setWeekdayFormat(e.target.value as WeekdayFormat)}
                className="select select-sm select-bordered min-w-[100px] text-right"
              >
                <option value="japanese">{weekdays.japanese[currentWeekday]}</option>
                <option value="short">{weekdays.short[currentWeekday]}</option>
                <option value="long">{weekdays.long[currentWeekday]}</option>
                <option value="none">非表示</option>
              </select>
            )}
          </div>
        </div>
      )}

      {/* 残り時間テキスト表示設定 */}
      <label
        className={`flex items-center justify-between cursor-pointer py-2 ${mode === "dark" ? "text-white" : "text-black"}`}
      >
        <span className="block font-medium">次の時間割表示</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={showRemainingText}
          onChange={(e) => {
            setShowRemainingText(e.target.checked);
            // 次の時間割表示がOFFになったら現在の時間割表示もOFFにする
            if (!e.target.checked) {
              setShowCurrentSchedule(false);
            }
          }}
        />
      </label>

      {/* 現在の時間割表示設定 */}
      {showRemainingText && (
        <label
          className={`flex items-center justify-between cursor-pointer py-2 ml-4 ${mode === "dark" ? "text-white" : "text-black"}`}
        >
          <span className="block font-medium">
            <span className="ml-1 ">{">"}</span>
            現在の時間割表示
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={showCurrentSchedule}
            onChange={(e) => setShowCurrentSchedule(e.target.checked)}
          />
        </label>
      )}

      {/* 進捗表示設定 */}
      <label
        className={`flex items-center justify-between cursor-pointer py-2 ${mode === "dark" ? "text-white" : "text-black"}`}
      >
        <span className="block font-medium">進捗バー表示</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={showProgress}
          onChange={(e) => setShowProgress(e.target.checked)}
        />
      </label>

      {/* 進捗バー色選択（進捗表示がONの場合のみ） */}
      {showProgress && (
        <div className="flex flex-col gap-2">
          <span className={`block font-medium ${mode === "dark" ? "text-white" : "text-black"}`}>
            進捗バーの色
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setProgressColor("blue")}
              className={`w-8 h-8 rounded-full bg-blue-500 border-2 transition-all ${
                progressColor === "blue" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("sky")}
              className={`w-8 h-8 rounded-full bg-sky-400 border-2 transition-all ${
                progressColor === "sky" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("green")}
              className={`w-8 h-8 rounded-full bg-green-500 border-2 transition-all ${
                progressColor === "green" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("yellow")}
              className={`w-8 h-8 rounded-full bg-yellow-400 border-2 transition-all ${
                progressColor === "yellow" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("pink")}
              className={`w-8 h-8 rounded-full bg-pink-500 border-2 transition-all ${
                progressColor === "pink" ? "border-white scale-110" : "border-transparent"
              }`}
            />
            <button
              onClick={() => setProgressColor("purple")}
              className={`w-8 h-8 rounded-full bg-purple-500 border-2 transition-all ${
                progressColor === "purple" ? "border-white scale-110" : "border-transparent"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
