import { useState, useEffect } from "react";
import { indexedDBManager } from "~/libs/indexedDB";

type ProgressColor = "blue" | "yellow" | "green" | "pink" | "purple" | "sky";
type YearFormat = "western" | "reiwa";
type MonthFormat = "japanese" | "english" | "number";
type DayFormat = "japanese" | "number";
type WeekdayFormat = "short" | "long" | "japanese";

export function useProgressSettings() {
  const [showProgress, setShowProgressState] = useState(true);
  const [progressColor, setProgressColorState] = useState<ProgressColor>("green");
  const [showRemainingText, setShowRemainingTextState] = useState(true);
  const [showDate, setShowDateState] = useState(false); // デフォルトはoff

  // 背景画像設定
  const [backgroundImage, setBackgroundImageState] = useState<string>("");
  const [backgroundImageFileName, setBackgroundImageFileNameState] = useState<string>("");
  const [showBackgroundImage, setShowBackgroundImageState] = useState(false); // 背景画像のon/off

  // 日付コンポーネント別設定
  const [showYear, setShowYearState] = useState(true);
  const [showMonth, setShowMonthState] = useState(true);
  const [showDay, setShowDayState] = useState(true);
  const [showWeekday, setShowWeekdayState] = useState(true);
  const [yearFormat, setYearFormatState] = useState<YearFormat>("western");
  const [monthFormat, setMonthFormatState] = useState<MonthFormat>("japanese");
  const [dayFormat, setDayFormatState] = useState<DayFormat>("japanese");
  const [weekdayFormat, setWeekdayFormatState] = useState<WeekdayFormat>("short");

  useEffect(() => {
    // localStorage から設定を読み込み
    const savedShowProgress = localStorage.getItem("showProgress");
    const savedProgressColor = localStorage.getItem("progressColor") as ProgressColor;
    const savedShowRemainingText = localStorage.getItem("showRemainingText");
    const savedShowDate = localStorage.getItem("showDate");

    if (savedShowProgress !== null) {
      setShowProgressState(savedShowProgress === "true");
    }

    if (
      savedProgressColor &&
      ["blue", "yellow", "green", "pink", "purple", "sky"].includes(savedProgressColor)
    ) {
      setProgressColorState(savedProgressColor);
    }

    if (savedShowRemainingText !== null) {
      setShowRemainingTextState(savedShowRemainingText === "true");
    }

    if (savedShowDate !== null) {
      setShowDateState(savedShowDate === "true");
    }

    // 背景画像設定をIndexedDBから読み込み（エラーハンドリング強化）
    const loadBackgroundImage = async () => {
      try {
        // IndexedDBが利用可能かチェック
        if (typeof window === "undefined" || !window.indexedDB) {
          return;
        }

        const savedBackgroundImageData = await indexedDBManager.getImage();
        if (savedBackgroundImageData && savedBackgroundImageData.data) {
          setBackgroundImageState(savedBackgroundImageData.data);
          setBackgroundImageFileNameState(savedBackgroundImageData.fileName || "");
        }
      } catch (error) {
        console.error("背景画像の読み込みに失敗しました:", error);
        // フォールバックとしてlocalStorageからも試す
        try {
          const fallbackImage = localStorage.getItem("backgroundImage");
          if (fallbackImage) {
            setBackgroundImageState(fallbackImage);
          }
        } catch (fallbackError) {
          console.error("localStorageからのフォールバック読み込みも失敗:", fallbackError);
        }
      }
    };

    // 非同期処理を安全に実行
    loadBackgroundImage().catch((error) => {
      console.error("loadBackgroundImage実行中にエラー:", error);
    });

    const savedShowBackgroundImage = localStorage.getItem("showBackgroundImage");
    if (savedShowBackgroundImage !== null) {
      setShowBackgroundImageState(savedShowBackgroundImage === "true");
    }

    // 日付コンポーネント設定の読み込み
    const savedShowYear = localStorage.getItem("showYear");
    const savedShowMonth = localStorage.getItem("showMonth");
    const savedShowDay = localStorage.getItem("showDay");
    const savedShowWeekday = localStorage.getItem("showWeekday");
    const savedYearFormat = localStorage.getItem("yearFormat") as YearFormat;
    const savedMonthFormat = localStorage.getItem("monthFormat") as MonthFormat;
    const savedDayFormat = localStorage.getItem("dayFormat") as DayFormat;
    const savedWeekdayFormat = localStorage.getItem("weekdayFormat") as WeekdayFormat;

    if (savedShowYear !== null) setShowYearState(savedShowYear === "true");
    if (savedShowMonth !== null) setShowMonthState(savedShowMonth === "true");
    if (savedShowDay !== null) setShowDayState(savedShowDay === "true");
    if (savedShowWeekday !== null) setShowWeekdayState(savedShowWeekday === "true");

    if (savedYearFormat && ["western", "reiwa"].includes(savedYearFormat)) {
      setYearFormatState(savedYearFormat);
    }
    if (savedMonthFormat && ["japanese", "english", "number"].includes(savedMonthFormat)) {
      setMonthFormatState(savedMonthFormat);
    }
    if (savedDayFormat && ["japanese", "number"].includes(savedDayFormat)) {
      setDayFormatState(savedDayFormat);
    }
    if (savedWeekdayFormat && ["short", "long", "japanese"].includes(savedWeekdayFormat)) {
      setWeekdayFormatState(savedWeekdayFormat);
    }
  }, []);

  const setShowProgress = (value: boolean) => {
    setShowProgressState(value);
    localStorage.setItem("showProgress", value.toString());
  };

  const setProgressColor = (color: ProgressColor) => {
    setProgressColorState(color);
    localStorage.setItem("progressColor", color);
  };

  const setShowRemainingText = (value: boolean) => {
    setShowRemainingTextState(value);
    localStorage.setItem("showRemainingText", value.toString());
  };

  const setShowDate = (value: boolean) => {
    setShowDateState(value);
    localStorage.setItem("showDate", value.toString());
  };

  // 背景画像設定のセッター関数
  const setBackgroundImage = async (imageData: string, fileName?: string) => {
    setBackgroundImageState(imageData);
    setBackgroundImageFileNameState(fileName || "");
    try {
      if (imageData) {
        await indexedDBManager.saveImage(imageData, fileName);
        // 成功したらlocalStorageからは削除（容量節約）
        localStorage.removeItem("backgroundImage");
      } else {
        await indexedDBManager.deleteImage();
        localStorage.removeItem("backgroundImage");
      }
    } catch (error) {
      console.error("背景画像の保存に失敗しました:", error);
      // フォールバックとしてlocalStorageに保存を試行
      if (imageData) {
        try {
          localStorage.setItem("backgroundImage", imageData);
        } catch (localStorageError) {
          console.error("localStorageへの保存も失敗しました:", localStorageError);
          alert("画像が大きすぎて保存できませんでした。より小さい画像を選択してください。");
        }
      } else {
        localStorage.removeItem("backgroundImage");
      }
    }
  };

  const setShowBackgroundImage = (value: boolean) => {
    setShowBackgroundImageState(value);
    localStorage.setItem("showBackgroundImage", value.toString());
  };

  // 日付コンポーネント設定のセッター関数
  const setShowYear = (value: boolean) => {
    setShowYearState(value);
    localStorage.setItem("showYear", value.toString());
  };

  const setShowMonth = (value: boolean) => {
    setShowMonthState(value);
    localStorage.setItem("showMonth", value.toString());
  };

  const setShowDay = (value: boolean) => {
    setShowDayState(value);
    localStorage.setItem("showDay", value.toString());
  };

  const setShowWeekday = (value: boolean) => {
    setShowWeekdayState(value);
    localStorage.setItem("showWeekday", value.toString());
  };

  const setYearFormat = (format: YearFormat) => {
    setYearFormatState(format);
    localStorage.setItem("yearFormat", format);
  };

  const setMonthFormat = (format: MonthFormat) => {
    setMonthFormatState(format);
    localStorage.setItem("monthFormat", format);
  };

  const setDayFormat = (format: DayFormat) => {
    setDayFormatState(format);
    localStorage.setItem("dayFormat", format);
  };

  const setWeekdayFormat = (format: WeekdayFormat) => {
    setWeekdayFormatState(format);
    localStorage.setItem("weekdayFormat", format);
  };

  return {
    showProgress,
    setShowProgress,
    progressColor,
    setProgressColor,
    showRemainingText,
    setShowRemainingText,
    showDate,
    setShowDate,
    // 背景画像設定
    backgroundImage,
    setBackgroundImage,
    backgroundImageFileName,
    showBackgroundImage,
    setShowBackgroundImage,
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
  };
}
