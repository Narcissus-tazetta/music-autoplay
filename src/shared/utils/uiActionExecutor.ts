import { getWindowExtensions } from "@/shared/schemas/global";
import type { ParsedApiErrorWithAction, UiAction } from "@/shared/utils/apiUi";
import { applyFieldErrorsToConform } from "@/shared/utils/formAdapters/conformAdapter";

const tryShowToast = (level: string, message: string) => {
  try {
    const winResult = getWindowExtensions();
    if (winResult?.success) {
      const app = winResult.data.__app__;
      if (app?.showToast) {
        app.showToast({ level, message });
        return;
      }
    }
  } catch (e) {
    void e;
  }

  console.warn(`TOAST[${level}]: ${message}`);
};

const tryRedirect = (to: string) => {
  try {
    const winResult = getWindowExtensions();
    const app = winResult?.success ? winResult.data.__app__ : undefined;
    if (app?.navigate) {
      app.navigate(to);
      return;
    }
  } catch (e) {
    void e;
  }
  window.location.href = to;
};

export type UiActionExecutorOptions = {
  conformFields?: Record<string, unknown> | undefined;
};

export function executeUiAction(
  action: UiAction,
  opts?: UiActionExecutorOptions,
) {
  switch (action.type) {
    case "noop":
      return;
    case "redirect":
      tryRedirect(action.to);
      return;
    case "showToast":
      tryShowToast(action.level, action.message);
      return;
    case "fieldErrors":
      try {
        if (opts?.conformFields) {
          const maybeFields = opts.conformFields;
          const looksLikeConform = Object.values(maybeFields).every((v) => {
            return (
              v &&
              typeof v === "object" &&
              "name" in (v as Record<string, unknown>)
            );
          });
          if (looksLikeConform) {
            applyFieldErrorsToConform(
              maybeFields as Parameters<typeof applyFieldErrorsToConform>[0],
              action.fields,
            );
            return;
          }
        }
        tryShowToast("error", Object.values(action.fields).join(" "));
      } catch {
        console.debug("uiActionExecutor action failed");
      }
      return;
    default:
      return;
  }
}

export function executeParsedApiError(
  parsed: ParsedApiErrorWithAction,
  opts?: UiActionExecutorOptions,
) {
  executeUiAction(parsed.action, opts);
}
