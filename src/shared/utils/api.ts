import { hasOwnProperty } from "./typeGuards";

export type ApiSuccess<T = unknown> = { success: true; data: T };
export type ApiError = {
  success: false;
  error: { code?: string; message: string; details?: unknown };
};
export type NormalizedApiResponse<T> = ApiSuccess<T> | ApiError;

function isNormalizedResponse(
  v: unknown,
): v is { success: boolean; data?: unknown; error?: unknown } {
  return (
    typeof v === "object" &&
    v !== null &&
    hasOwnProperty(v as Record<string, unknown>, "success")
  );
}

async function parseJsonSafe(resp: Response): Promise<unknown> {
  try {
    const t = await resp.text();
    if (!t) return null;
    return JSON.parse(t);
  } catch {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }
}

export async function normalizeApiResponse<T = unknown>(
  resp: Response,
): Promise<NormalizedApiResponse<T>> {
  const parsed = await parseJsonSafe(resp);

  if (isNormalizedResponse(parsed)) {
    const p = parsed as { success: boolean; data?: unknown; error?: unknown };
    if (p.success) return { success: true, data: p.data as T };
    const maybeErr: unknown = p.error;
    let code: string | undefined;
    if (
      typeof maybeErr === "object" &&
      maybeErr !== null &&
      "code" in maybeErr
    ) {
      const c = (maybeErr as Record<string, unknown>).code;
      if (typeof c === "string" || typeof c === "number") code = String(c);
    }

    let message: string;
    if (
      typeof maybeErr === "object" &&
      maybeErr !== null &&
      "message" in maybeErr
    ) {
      const m = (maybeErr as Record<string, unknown>).message;
      if (typeof m === "string") message = m;
      else {
        try {
          message = JSON.stringify(m);
        } catch {
          message = Object.prototype.toString.call(m);
        }
      }
    } else {
      try {
        message = JSON.stringify(p);
      } catch {
        message = Object.prototype.toString.call(p as unknown);
      }
    }

    const details =
      typeof maybeErr === "object" && maybeErr !== null
        ? (maybeErr as Record<string, unknown>).details
        : undefined;

    return { success: false, error: { code, message, details } };
  }

  if (resp.ok) return { success: true, data: parsed as T };

  const message =
    typeof parsed === "string" ? parsed : resp.statusText || "request failed";
  return {
    success: false,
    error: { code: String(resp.status), message, details: parsed },
  };
}

export default normalizeApiResponse;
