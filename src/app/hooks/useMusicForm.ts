import { getMessage } from "@/shared/constants/messages";
import { AddMusicSchema } from "@/shared/schemas/music";
import type { SubmissionResult } from "@conform-to/dom";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

interface FetcherData {
  status: "success" | "error";
  error?: string;
  [key: string]: unknown;
}

export function useMusicForm() {
  const fetcher = useFetcher();
  const hasShownToastRef = useRef(false);
  const lastStateRef = useRef(fetcher.state);
  const [retryAfter, setRetryAfter] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  const [form, fields] = useForm({
    lastResult: fetcher.data as SubmissionResult | null | undefined,
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: AddMusicSchema }),
  });

  const isSubmitting = fetcher.state === "submitting";
  const canSubmit = !fields.url.errors?.length && !isSubmitting;

  useEffect(() => {
    const wasSubmitting = lastStateRef.current !== "idle";
    const isNowIdle = fetcher.state === "idle";
    const data = fetcher.data as FetcherData | null | undefined;

    if (wasSubmitting && isNowIdle && data?.status === "success") {
      if (!hasShownToastRef.current) {
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
              { conformFields: fields as Record<string, unknown> },
            );
          } catch (err: unknown) {
            if (import.meta.env.DEV) console.debug("showToast failed", err);
          }
        })();
      }
    }

    if (wasSubmitting && isNowIdle && data?.error) {
      const response = fetcher.data as { error: string };
      const errorMessage =
        typeof response.error === "string"
          ? response.error
          : String(response.error);
      const isRateLimitError = errorMessage.includes("レート制限");

      if (isRateLimitError) {
        const retryAfterHeader = (
          fetcher.data as unknown as { headers?: Headers }
        ).headers;
        let seconds = 60;

        if (retryAfterHeader instanceof Headers) {
          const retryValue = retryAfterHeader.get("Retry-After");
          if (retryValue) {
            const parsed = parseInt(retryValue, 10);
            if (!isNaN(parsed)) seconds = parsed;
          }
        }

        if (retryAfter === 0) {
          setRetryAfter(seconds);

          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => {
            setRetryAfter((prev) => {
              if (prev <= 1) {
                clearInterval(intervalRef.current);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      }

      void (async () => {
        try {
          const mod = await import("@/shared/utils/uiActionExecutor");
          mod.executeUiAction(
            {
              type: "showToast",
              level: "error",
              message: errorMessage,
            },
            { conformFields: fields as Record<string, unknown> },
          );
        } catch (err: unknown) {
          if (import.meta.env.DEV) console.debug("showToast failed", err);
        }
      })();
    }

    if (fetcher.state === "submitting") hasShownToastRef.current = false;

    lastStateRef.current = fetcher.state;
  }, [fetcher.state, fetcher.data, fields, retryAfter]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  return {
    fetcher,
    form,
    fields,
    isSubmitting,
    canSubmit,
    retryAfter,
  };
}
