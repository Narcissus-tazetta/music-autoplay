import { useSettingsStore } from "@/shared/stores/settingsStore";
import { useEffect, useRef } from "react";

export function useSettingsSync() {
  const settings = useSettingsStore();
  const ytStatusVisible = settings.ytStatusVisible;
  const setYtStatusVisible = settings.setYtStatusVisible;
  const loadFromServer = settings.loadFromServer;
  const syncToServer = settings.syncToServer;

  const initRef = useRef<{ loaded: boolean; prevValue: boolean }>({
    loaded: false,
    prevValue: ytStatusVisible,
  });

  useEffect(() => {
    const state = initRef.current;

    if (!state.loaded) {
      state.loaded = true;
      state.prevValue = ytStatusVisible;
      if (typeof loadFromServer === "function") loadFromServer();
      return;
    }

    if (state.prevValue !== ytStatusVisible) {
      state.prevValue = ytStatusVisible;
      if (typeof syncToServer === "function") syncToServer();
    }
  }, [loadFromServer, syncToServer, ytStatusVisible]);

  return {
    ytStatusVisible,
    setYtStatusVisible,
  };
}
