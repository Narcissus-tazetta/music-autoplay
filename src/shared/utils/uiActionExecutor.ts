import type { ParsedApiErrorWithAction, UiAction } from "@/shared/utils/apiUi";
import { applyFieldErrorsToConform } from "@/shared/utils/formAdapters/conformAdapter";

const tryShowToast = (level: string, message: string) => {
  try {
    const g = (
      window as unknown as {
        __app__?: {
          showToast?: (opts: { level: string; message: string }) => void;
        };
      }
    ).__app__;
    if (g && typeof g.showToast === "function") {
      g.showToast({ level, message });
      return;
    }
  } catch (e) {
    void e;
  }

  console.warn(`TOAST[${level}]: ${message}`);
};

const tryRedirect = (to: string) => {
  try {
    const g = (
      window as unknown as { __app__?: { navigate?: (to: string) => void } }
    ).__app__;
    if (g && typeof g.navigate === "function") {
      g.navigate(to);
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

export default { executeUiAction, executeParsedApiError };
