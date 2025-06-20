/**
 * 日付フォーマット関連のユーティリティ関数
 */

export interface DateFormatSettings {
  showYear: boolean;
  showMonth: boolean;
  showDay: boolean;
  showWeekday: boolean;
  yearFormat: "western" | "reiwa" | "2025";
  monthFormat: "japanese" | "english" | "number";
  dayFormat: "japanese" | "number" | "english";
  weekdayFormat: "japanese" | "short" | "long";
}

/**
 * 設定に基づいて現在の日付をフォーマットする
 */
export function formatCurrentDate(settings: DateFormatSettings): string {
  const now = new Date();
  let dateString = "";

  // 年表示
  if (settings.showYear) {
    if (settings.yearFormat === "reiwa") {
      const reiwaYear = now.getFullYear() - 2018; // 令和元年は2019年
      dateString += `令和${reiwaYear}年`;
    } else if (settings.yearFormat === "2025") {
      dateString += `${now.getFullYear()}`;
    } else {
      dateString += `${now.getFullYear()}年`;
    }
  }

  // 月表示
  if (settings.showMonth) {
    if (settings.monthFormat === "japanese") {
      dateString += `${now.getMonth() + 1}月`;
    } else if (settings.monthFormat === "english") {
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
    } else if (settings.monthFormat === "number") {
      dateString += String(now.getMonth() + 1).padStart(2, "0") + "/";
    }
  }

  // 日表示
  if (settings.showDay) {
    if (settings.dayFormat === "japanese") {
      dateString += `${now.getDate()}日`;
    } else if (settings.dayFormat === "english") {
      const day = now.getDate();
      const suffix = getOrdinalSuffix(day);
      dateString += `${day}${suffix}`;
    } else {
      dateString += `${now.getDate()}`;
    }
  }

  // 曜日表示
  if (settings.showWeekday) {
    const weekdays = {
      japanese: ["日", "月", "火", "水", "木", "金", "土"],
      short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    };
    const dayIndex = now.getDay(); // 0:日, 1:月, ..., 5:金, 6:土
    const weekday = weekdays[settings.weekdayFormat][dayIndex];

    if (settings.weekdayFormat === "japanese") {
      dateString += `（${weekday}）`;
    } else {
      dateString += ` ${weekday}`;
    }
  }

  return dateString.trim();
}

/**
 * 英語の序数詞のサフィックスを取得（1st, 2nd, 3rd, 4th...）
 */
function getOrdinalSuffix(day: number): string {
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
}
