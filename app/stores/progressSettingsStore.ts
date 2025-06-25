import { create } from "zustand";
import { persist } from "zustand/middleware";

type ProgressColor = "blue" | "yellow" | "green" | "pink" | "purple" | "sky";

interface ProgressSettingsState {
  showProgress: boolean;
  setShowProgress: (value: boolean) => void;
  progressColor: ProgressColor;
  setProgressColor: (color: ProgressColor) => void;
}

export const useProgressSettingsStore = create<ProgressSettingsState>()(
  persist(
    (set) => ({
      showProgress: true,
      setShowProgress: (value) => set({ showProgress: value }),
      progressColor: "green",
      setProgressColor: (color) => set({ progressColor: color }),
    }),
    {
      name: "progress-settings",
    }
  )
);
