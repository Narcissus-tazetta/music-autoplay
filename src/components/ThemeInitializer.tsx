import { useEffect } from "react";
import { useColorModeStore } from "../features/settings/stores/colorModeStore";

export function ThemeInitializer() {
  const mode = useColorModeStore((s) => s.mode);
  const setMode = useColorModeStore((s) => s.setMode);

  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);

  return null;
}
