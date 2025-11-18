import { getMessage } from "@/shared/constants/messages";
import { useEffect, useRef } from "react";

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
  const hasShownToastRef = useRef(false);
  const lastFetcherStateRef = useRef<string>(fetcherState);

  useEffect(() => {
    if (lastFetcherStateRef.current !== "idle" && fetcherState === "idle") {
      if (fetcherData && typeof fetcherData === "object") {
        const data = fetcherData as { status?: string };
        if (data.status === "success" && !hasShownToastRef.current) {
          hasShownToastRef.current = true;
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
            } catch (err: unknown) {
              if (import.meta.env.DEV) console.debug("showToast failed", err);
            }
          })();
        }
      }
    }
    if (lastFetcherStateRef.current !== fetcherState) {
      if (fetcherState === "submitting" || fetcherState === "loading")
        hasShownToastRef.current = false;
      lastFetcherStateRef.current = fetcherState;
    }
  }, [fetcherState, fetcherData, conformFields]);
}
