import { parseApiErrorForUI } from "@/shared/utils/apiUi";
import { extractErrorMessage } from "@/shared/utils/formatError";
import { useMemo } from "react";

import type { UiAction } from "@/shared/utils/apiUi";

export function useFormErrors(fetcherData: unknown) {
  const rawFetchData = fetcherData;

  const candidate = useMemo(() => {
    if (
      rawFetchData &&
      typeof rawFetchData === "object" &&
      "result" in (rawFetchData as Record<string, unknown>)
    )
      return (rawFetchData as Record<string, unknown>).result;
    return rawFetchData;
  }, [rawFetchData]);

  const parsedAction = useMemo(() => {
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
          return parsed.action as UiAction | undefined;
        }
      }
    } catch (e) {
      /* ignore parse errors from unexpected shapes */
      void e;
    }
    return undefined;
  }, [candidate]);

  const formErrorsString = useMemo(() => {
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
            if (fe) return Object.values(fe).join(" ");
          }
          return parsed.message;
        }
      }
    } catch (e) {
      /* ignore parse errors from unexpected shapes */
      void e;
    }

    return (
      extractErrorMessage(candidate, { joinWith: " " }) ??
      extractErrorMessage(fetcherData, { joinWith: " " }) ??
      undefined
    );
  }, [candidate, fetcherData]);

  return { rawFetchData, candidate, formErrorsString, parsedAction } as const;
}

export default useFormErrors;
