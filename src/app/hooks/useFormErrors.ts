import { parseApiErrorForUI } from "@/shared/utils/apiUi";
import type { UiAction } from "@/shared/utils/apiUi";
import { extractErrorMessage } from "@/shared/utils/errors/client";

export function useFormErrors(fetcherData: unknown): {
  readonly rawFetchData: unknown;
  readonly candidate: unknown;
  readonly formErrorsString: string | undefined;
  readonly parsedAction: UiAction | undefined;
} {
  const rawFetchData = fetcherData;

  const candidate =
    rawFetchData &&
    typeof rawFetchData === "object" &&
    "result" in (rawFetchData as Record<string, unknown>)
      ? (rawFetchData as Record<string, unknown>).result
      : rawFetchData;

  let parsedAction: UiAction | undefined = undefined;
  try {
    if (
      candidate &&
      typeof candidate === "object" &&
      "success" in (candidate as Record<string, unknown>)
    ) {
      const c = candidate as Record<string, unknown>;
      if (c.success === false && c.error && typeof c.error === "object") {
        const errObj = c.error as Record<string, unknown>;
        const parsed = parseApiErrorForUI({
          code: errObj.code as string | null | undefined,
          message:
            typeof errObj.message === "string" ? errObj.message : "エラー",
          details: errObj.details,
        });
        parsedAction = parsed.action as UiAction | undefined;
      }
    }
  } catch {
    // Ignore parse errors
  }

  let formErrorsString: string | undefined = undefined;
  try {
    if (
      candidate &&
      typeof candidate === "object" &&
      "success" in (candidate as Record<string, unknown>)
    ) {
      const c = candidate as Record<string, unknown>;
      if (c.success === false && c.error && typeof c.error === "object") {
        const errObj = c.error as Record<string, unknown>;
        const parsed = parseApiErrorForUI({
          code: errObj.code as string | null | undefined,
          message:
            typeof errObj.message === "string" ? errObj.message : "エラー",
          details: errObj.details,
        });
        if (
          parsed.kind === "validation" &&
          (parsed as Record<string, unknown>).fieldErrors
        ) {
          const fe = (parsed as Record<string, unknown>).fieldErrors as
            | Record<string, string>
            | undefined;
          if (fe) formErrorsString = Object.values(fe).join(" ");
        } else {
          formErrorsString = parsed.message;
        }
      }
    }
  } catch {
    // Ignore parse errors
  }

  if (!formErrorsString) {
    formErrorsString =
      extractErrorMessage(candidate, { joinWith: " " }) ??
      extractErrorMessage(fetcherData, { joinWith: " " }) ??
      undefined;
  }

  return { rawFetchData, candidate, formErrorsString, parsedAction } as const;
}

export default useFormErrors;
