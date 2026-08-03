import { createHash } from 'node:crypto';
import { extractErrorInfo, safeString } from './core';

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
    for (const errors of Object.values(fieldErrors)) if (Array.isArray(errors)) allErrors.push(...errors);

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

    return createErrorReply('内部サーバーエラーが発生しました', 'INTERNAL_ERROR');
}

export function createAuthErrorReply(customMessage?: string): ReplyOptions {
    return createErrorReply(
        customMessage || 'この操作を実行する権限がありません',
        'UNAUTHORIZED',
    );
}

export function createRateLimitReply(retryAfter?: number): ReplyOptions {
    const message = retryAfter
        ? `リクエストが多すぎます。${retryAfter}秒後に再試行してください`
        : 'リクエストが多すぎます。しばらく待ってから再試行してください';

    return createErrorReply(message, 'RATE_LIMIT_EXCEEDED');
}

export function createAdminHash(secretCandidate: unknown): string {
    const secretString = safeString(secretCandidate);
    if (!secretString) return createHash('sha256').update('').digest('hex');

    return createHash('sha256').update(secretString).digest('hex');
}

export function isSuccessReply(reply: ReplyOptions): boolean {
    const formErrors = (reply as { formErrors?: string[] }).formErrors;
    const fieldErrors = (reply as { fieldErrors?: Record<string, string[]> })
        .fieldErrors;

    const hasFormErrors = Array.isArray(formErrors) && formErrors.length > 0;
    const hasFieldErrors = fieldErrors && Object.keys(fieldErrors).length > 0;

    return !hasFormErrors && !hasFieldErrors;
}
