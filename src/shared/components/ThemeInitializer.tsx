import { useEffect } from "react";
import { useColorModeStore } from "../../features/settings/stores/colorModeStore";

export function ThemeInitializer() {
  const mode = useColorModeStore((s) => s.mode);
  const setMode = useColorModeStore((s) => s.setMode);

  useEffect(() => {
    // Apply the persisted mode immediately to avoid flicker and ensure the store is synced.
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    setMode(mode);
  }, [mode, setMode]);

  return null;
}
