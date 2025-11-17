import { getMessage } from "@/shared/constants/messages";
import { useEffect } from "react";

interface UseToastNotificationOptions {
  fetcherState: "idle" | "submitting" | "loading";
  fetcherData: unknown;
  conformFields: unknown;
}

export function useToastNotification({
  fetcherState,
  fetcherData,
  conformFields,
}: UseToastNotificationOptions): void {
  useEffect(() => {
    if (
      fetcherState === "idle" &&
      fetcherData &&
      typeof fetcherData === "object"
    ) {
      const data = fetcherData as { status?: string };
      if (data.status === "success") {
        void (async () => {
          try {
            const mod = await import("@/shared/utils/uiActionExecutor");
            mod.executeUiAction(
              {
                type: "showToast",
                level: "success",
                message: getMessage("SUCCESS_ADDED"),
              },
              { conformFields: conformFields as Record<string, unknown> },
            );
          } catch (err) {
            if (import.meta.env.DEV) console.debug("showToast failed", err);
          }
        })();
      }
    }
  }, [fetcherState, fetcherData, conformFields]);
}
