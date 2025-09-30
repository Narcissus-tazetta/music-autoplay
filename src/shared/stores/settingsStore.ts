import normalizeApiResponse from "@/shared/utils/api";
import { parseApiErrorForUI } from "@/shared/utils/apiUi";
import { useAppSettings } from "./appSettings";

export interface SettingsStore {
  ytStatusVisible: boolean;
  setYtStatusVisible: (v: boolean) => void;
  loadFromServer?: () => Promise<void>;
  syncToServer?: () => Promise<void>;
}

export const useSettingsStore = (): SettingsStore => {
  const { ui, updateUI } = useAppSettings();

  return {
    ytStatusVisible: ui.ytStatusVisible,
    setYtStatusVisible: (v: boolean) => {
      updateUI({ ytStatusVisible: v });
    },
    async loadFromServer() {
      try {
        const resp = await fetch("/api/settings");
        const norm =
          await normalizeApiResponse<Partial<{ ytStatusVisible: boolean }>>(
            resp,
          );
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
          updateUI({ ytStatusVisible: server.ytStatusVisible });
      } catch (_e: unknown) {
        console.warn("loadFromServer error", _e);
      }
    },
    async syncToServer() {
      try {
        const payload = { ytStatusVisible: ui.ytStatusVisible };
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
    },
  };
};

export default useSettingsStore;
