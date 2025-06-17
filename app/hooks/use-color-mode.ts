import { useState, useEffect } from "react";
import { changeMode, useSmoothBodyColor } from "~/libs/utils";

export function useColorMode() {
  const [mode, setModeState] = useState<"dark" | "light">("light");

  useEffect(() => {
    const savedMode = (localStorage.getItem("selectedMode") as "dark" | "light") || "light";
    setModeState(savedMode);
    changeMode(savedMode);
  }, []);

  useSmoothBodyColor(mode === "dark" ? "#212225" : "#fff", mode === "dark" ? "#E8EAED" : "#212225");

  const setMode = (newMode: "dark" | "light") => {
    setModeState(newMode);
    changeMode(newMode);
  };

  const darkClass = mode === "dark" ? "dark" : "";

  return { mode, setMode, darkClass };
}
