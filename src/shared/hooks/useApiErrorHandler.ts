import normalizeApiResponse from "@/shared/utils/api";
import { parseApiErrorForUI } from "@/shared/utils/apiUi";
import { useCallback } from "react";

export const useApiErrorHandler = () => {
  return useCallback(async (error: unknown) => {
    try {
      let message: string;
      let code: string | undefined;
      let details: unknown;

      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        message = error.message;
        if (
          "code" in error &&
          (typeof error.code === "string" || typeof error.code === "number")
        )
          code = String(error.code);
        if ("details" in error) details = error.details;
      } else if (typeof error === "string") message = error;
      else {
        try {
          message = JSON.stringify(error);
        } catch {
          message = Object.prototype.toString.call(error ?? undefined);
        }
      }

      const parsed = parseApiErrorForUI({ code, message, details });

      try {
        const mod = await import("@/shared/utils/uiActionExecutor");
        mod.executeParsedApiError(parsed, { conformFields: undefined });
      } catch (execError) {
        if (import.meta.env.DEV)
          console.error("uiActionExecutor failed", execError);
        throw new Error(parsed.message);
      }
    } catch (parseError) {
      if (import.meta.env.DEV)
        console.error("parseApiErrorForUI failed", parseError);
      throw error;
    }
  }, []);
};

export const useApiResponseHandler = () => {
  const handleError = useApiErrorHandler();

  return useCallback(
    async <T>(response: Response): Promise<T> => {
      const norm = await normalizeApiResponse<T>(response);
      if (!norm.success) {
        await handleError(norm.error);
        throw new Error(norm.error.message);
      }
      return norm.data;
    },
    [handleError],
  );
};
