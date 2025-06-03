import { useState, useEffect } from "react";
import { changeMode, useSmoothBodyColor } from "../libs/utils";

export function useColorMode() {
  const [mode, setModeState] = useState<"dark" | "light">("light");

  // 初回ロード時にlocalStorageから取得
  useEffect(() => {
    const savedMode = (localStorage.getItem("selectedMode") as "dark" | "light") || "light";
    setModeState(savedMode);
    changeMode(savedMode);
  }, []);

  // ダーク・ライトのbody色をスムーズに
  useSmoothBodyColor(
    mode === "dark" ? "#212225" : "#fff",
    mode === "dark" ? "#E8EAED" : "#212225"
  );

  // モード変更時の副作用
  const setMode = (newMode: "dark" | "light") => {
    setModeState(newMode);
    changeMode(newMode);
  };

  const darkClass = mode === "dark" ? "dark-mode" : "";

  return { mode, setMode, darkClass };
}
