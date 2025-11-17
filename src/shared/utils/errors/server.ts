import { createHash } from "crypto";
import { extractErrorInfo, safeString } from "./core";

export type ReplyOptions =
  | {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      code?: string;
    }
  | Record<string, unknown>;

export type SuccessReply = Record<string, never>;
export function createErrorReply(message: string, code?: string): ReplyOptions {
  return {
    formErrors: [message],
    ...(code && { code }),
  };
}

export function createValidationErrorReply(
  fieldErrors: Record<string, string[]>,
): ReplyOptions {
  const allErrors: string[] = [];
  for (const errors of Object.values(fieldErrors))
    if (Array.isArray(errors)) allErrors.push(...errors);

  return {
    fieldErrors,
    ...(allErrors.length > 0 && { formErrors: allErrors }),
  };
}

export function createServerErrorReply(error?: unknown): ReplyOptions {
  if (error) {
    const info = extractErrorInfo(error);
    void info;
  }

  return createErrorReply("内部サーバーエラーが発生しました", "INTERNAL_ERROR");
}

export function createSuccessReply(): SuccessReply {
  return {};
}

export function createAuthErrorReply(customMessage?: string): ReplyOptions {
  return createErrorReply(
    customMessage || "この操作を実行する権限がありません",
    "UNAUTHORIZED",
  );
}

export function createNotFoundReply(
  resource: string = "リソース",
): ReplyOptions {
  return createErrorReply(`${resource}が見つかりませんでした`, "NOT_FOUND");
}

export function createDuplicateReply(
  resource: string,
  details?: string,
): ReplyOptions {
  const message = details
    ? `${resource}はすでに${details}に登録されています`
    : `${resource}はすでに登録されています`;

  return createErrorReply(message, "DUPLICATE");
}

export function createRateLimitReply(retryAfter?: number): ReplyOptions {
  const message = retryAfter
    ? `リクエストが多すぎます。${retryAfter}秒後に再試行してください`
    : "リクエストが多すぎます。しばらく待ってから再試行してください";

  return createErrorReply(message, "RATE_LIMIT_EXCEEDED");
}

export function createAdminHash(secretCandidate: unknown): string {
  const secretString = safeString(secretCandidate);

  // Empty string case - return hash of empty string for consistency
  if (!secretString) return createHash("sha256").update("").digest("hex");

  return createHash("sha256").update(secretString).digest("hex");
}

export function isSuccessReply(reply: ReplyOptions): boolean {
  const formErrors = (reply as { formErrors?: string[] }).formErrors;
  const fieldErrors = (reply as { fieldErrors?: Record<string, string[]> })
    .fieldErrors;

  const hasFormErrors = Array.isArray(formErrors) && formErrors.length > 0;
  const hasFieldErrors = fieldErrors && Object.keys(fieldErrors).length > 0;

  return !hasFormErrors && !hasFieldErrors;
}

export function isErrorReply(reply: ReplyOptions): boolean {
  return !isSuccessReply(reply);
}

export function extractReplyErrors(reply: ReplyOptions): string[] {
  const errors: string[] = [];

  const formErrors = (reply as { formErrors?: string[] }).formErrors;
  if (Array.isArray(formErrors)) errors.push(...formErrors);

  const fieldErrors = (reply as { fieldErrors?: Record<string, string[]> })
    .fieldErrors;
  if (fieldErrors) {
    for (const fieldErrs of Object.values(fieldErrors))
      if (Array.isArray(fieldErrs)) errors.push(...fieldErrs);
  }

  return errors;
}

export function mapErrorToCode(error: unknown): string {
  const info = extractErrorInfo(error);

  if (info.code) return info.code;

  const msg = info.message.toLowerCase();

  if (
    msg.includes("権限") ||
    msg.includes("permission") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden")
  ) {
    return "UNAUTHORIZED";
  }

  if (
    msg.includes("invalid") ||
    msg.includes("不正") ||
    msg.includes("validation") ||
    msg.includes("検証")
  ) {
    return "VALIDATION_ERROR";
  }

  if (msg.includes("not found") || msg.includes("見つかりません"))
    return "NOT_FOUND";

  if (
    msg.includes("duplicate") ||
    msg.includes("すでに") ||
    msg.includes("既に")
  ) {
    return "DUPLICATE";
  }

  if (
    msg.includes("network") ||
    msg.includes("connection") ||
    msg.includes("timeout")
  ) {
    return "NETWORK_ERROR";
  }

  return "INTERNAL_ERROR";
}
