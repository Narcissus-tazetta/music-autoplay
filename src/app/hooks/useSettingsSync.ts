import { useSettingsStore } from "@/shared/stores/settingsStore";
import { useEffect, useRef } from "react";

export function useSettingsSync() {
  const settings = useSettingsStore();
  const ytStatusVisible = settings.ytStatusVisible;
  const setYtStatusVisible = settings.setYtStatusVisible;
  const loadFromServer = settings.loadFromServer;
  const syncToServer = settings.syncToServer;

  const hasLoadedRef = useRef(false);
  const prevValueRef = useRef(ytStatusVisible);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      prevValueRef.current = ytStatusVisible;
      if (typeof loadFromServer === "function") loadFromServer();
      return;
    }

    if (prevValueRef.current !== ytStatusVisible) {
      prevValueRef.current = ytStatusVisible;
      if (typeof syncToServer === "function") syncToServer();
    }
  }, [loadFromServer, syncToServer, ytStatusVisible]);

  return {
    ytStatusVisible,
    setYtStatusVisible,
  };
}
