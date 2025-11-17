import type { UiAction } from "@/shared/utils/apiUi";
import { useEffect } from "react";

interface UseUiActionExecutorOptions {
  parsedAction: UiAction | null | undefined;
  conformFields: unknown;
}

export function useUiActionExecutor({
  parsedAction,
  conformFields,
}: UseUiActionExecutorOptions): void {
  useEffect(() => {
    if (!parsedAction) return;
    void (async () => {
      try {
        const mod = await import("@/shared/utils/uiActionExecutor");
        try {
          mod.executeUiAction(parsedAction, {
            conformFields: conformFields as Record<string, unknown> | undefined,
          });
        } catch (err) {
          if (import.meta.env.DEV)
            console.debug("uiActionExecutor.executeUiAction failed", err);
        }
      } catch (err) {
        if (import.meta.env.DEV)
          console.debug("dynamic import uiActionExecutor failed", err);
      }
    })();
  }, [parsedAction, conformFields]);
}
