import { useState, useEffect } from "react";

type ProgressColor = "blue" | "yellow" | "green" | "pink" | "purple" | "sky";

export function useProgressSettings() {
  const [showProgress, setShowProgressState] = useState(true);
  const [progressColor, setProgressColorState] = useState<ProgressColor>("green");

  useEffect(() => {
    // localStorage から設定を読み込み
    const savedShowProgress = localStorage.getItem("showProgress");
    const savedProgressColor = localStorage.getItem("progressColor") as ProgressColor;

    if (savedShowProgress !== null) {
      setShowProgressState(savedShowProgress === "true");
    }

    if (
      savedProgressColor &&
      ["blue", "yellow", "green", "pink", "purple", "sky"].includes(savedProgressColor)
    ) {
      setProgressColorState(savedProgressColor);
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

  return {
    showProgress,
    setShowProgress,
    progressColor,
    setProgressColor,
  };
}
