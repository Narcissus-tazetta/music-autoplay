import type { ApiError } from './api';

type UiFieldErrors = Record<string, string>;

export type ParsedApiError =
    | { kind: 'unauthorized'; message: string }
    | { kind: 'forbidden'; message: string }
    | { kind: 'validation'; message: string; fieldErrors?: UiFieldErrors }
    | { kind: 'internal'; message: string };

/**
 * Classifies a normalized API error so callers can decide how to present it.
 *
 * It deliberately stops at the classification: it used to also pick a `UiAction`
 * (toast/redirect/field errors) for the caller, which routed most messages into a toast
 * channel no build ever implemented, so those errors reached nobody.
 */
export function parseApiErrorForUI(err: ApiError): ParsedApiError {
    const code = ((): string => {
        if (typeof err.code === 'string') return err.code.toLowerCase();
        if (typeof err.code === 'number') return String(err.code).toLowerCase();
        return '';
    })();
    const message = err.message || 'サーバーでエラーが発生しました';

    if (code === 'unauthorized' || code === '401' || code === 'not_authenticated')
        return { kind: 'unauthorized', message: '認証が必要です。ログインしてください。' };

    if (code === 'forbidden' || code === '403') return { kind: 'forbidden', message };

    if (code === 'validation' || code === 'unprocessable' || code === '422') {
        const fieldErrors = extractFieldErrors(err.details);
        return fieldErrors
            ? { fieldErrors, kind: 'validation', message }
            : { kind: 'validation', message };
    }

    return { kind: 'internal', message };
}

function extractFieldErrors(details: unknown): UiFieldErrors | undefined {
    if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined;

    const fieldErrors: UiFieldErrors = {};
    for (const [key, value] of Object.entries(details as Record<string, unknown>))
        if (typeof value === 'string') fieldErrors[key] = value;

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}
