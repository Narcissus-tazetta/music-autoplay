import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SettingsStore {
  ytStatusVisible: boolean;
  setYtStatusVisible: (v: boolean) => void;
  loadFromServer?: () => Promise<void>;
  syncToServer?: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ytStatusVisible: true,
      setYtStatusVisible: (v: boolean) => {
        set({ ytStatusVisible: v });
      },
      async loadFromServer() {
        try {
          const res = await fetch("/api/settings");
          if (!res.ok) return;
          const server = (await res.json()) as Partial<SettingsStore> | null;
          const current: Partial<SettingsStore> = {
            ytStatusVisible: get().ytStatusVisible,
          };
          const merged: Partial<SettingsStore> = { ...server, ...current };
          set((state) => ({ ...state, ...merged }));
        } catch (e: unknown) {
          console.warn("loadFromServer error", e);
        }
      },
      async syncToServer() {
        try {
          const payload = { ytStatusVisible: get().ytStatusVisible };
          await fetch("/api/settings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
        } catch (e: unknown) {
          // best-effort logging

          console.warn("syncToServer error", e);
        }
      },
    }),
    {
      name: "music-autoplay:settings",
      version: 1,
    },
  ),
);

export default useSettingsStore;
