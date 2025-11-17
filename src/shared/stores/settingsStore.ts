import normalizeApiResponse from "@/shared/utils/api";
import { parseApiErrorForUI } from "@/shared/utils/apiUi";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SettingsStore {
  ytStatusVisible: boolean;
  setYtStatusVisible: (v: boolean) => void;
  loadFromServer: (data?: Partial<{ ytStatusVisible: boolean }>) => void;
  syncToServer: () => { ytStatusVisible: boolean };
  reset: () => void;
}

const loadFromServerAsync = async (): Promise<void> => {
  try {
    const resp = await fetch("/api/settings");
    const norm =
      await normalizeApiResponse<Partial<{ ytStatusVisible: boolean }>>(resp);
    if (!norm.success) {
      try {
        const err = norm.error;
        const parsed = parseApiErrorForUI({
          code: err.code ?? undefined,
          message: err.message,
          details: err.details,
        });
        try {
          const mod = await import("@/shared/utils/uiActionExecutor");
          mod.executeParsedApiError(parsed, { conformFields: undefined });
        } catch (errExec) {
          console.warn("loadFromServer server error", parsed, errExec);
        }
      } catch {
        console.warn("loadFromServer server error", norm.error);
      }
      return;
    }
    const server = norm.data;
    if (typeof server.ytStatusVisible === "boolean")
      useSettingsStore.getState().setYtStatusVisible(server.ytStatusVisible);
  } catch (_e: unknown) {
    console.warn("loadFromServer error", _e);
  }
};

const _syncToServerAsync = async (): Promise<void> => {
  try {
    const payload = {
      ytStatusVisible: useSettingsStore.getState().ytStatusVisible,
    };
    const resp = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const norm = await normalizeApiResponse(resp);
    if (!norm.success) {
      try {
        const err = norm.error;
        const parsed = parseApiErrorForUI({
          code: err.code ?? undefined,
          message: err.message,
          details: err.details,
        });
        try {
          const mod = await import("@/shared/utils/uiActionExecutor");
          mod.executeParsedApiError(parsed, { conformFields: undefined });
        } catch (errExec) {
          console.warn("syncToServer error", parsed, errExec);
        }
      } catch {
        console.warn("syncToServer error", norm.error);
      }
    }
  } catch (_e: unknown) {
    console.warn("syncToServer error", _e);
  }
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ytStatusVisible: true,
      setYtStatusVisible: (v: boolean) => set({ ytStatusVisible: v }),
      loadFromServer: (data?: Partial<{ ytStatusVisible: boolean }>) => {
        if (!data) {
          void loadFromServerAsync();
          return;
        }
        if (typeof data.ytStatusVisible === "boolean")
          set({ ytStatusVisible: data.ytStatusVisible });
      },
      syncToServer: () => {
        void _syncToServerAsync();
        return { ytStatusVisible: get().ytStatusVisible };
      },
      reset: () => set({ ytStatusVisible: true }),
    }),
    { name: "settings-storage" },
  ),
);

export default useSettingsStore;
