export interface ApiError {
    code?: string | null;
    message: string;
    details?: unknown;
}

export type NormalizedApiResponse<T> =
    | { success: true; data: T }
    | { success: false; error: ApiError };

export type UiFieldErrors = Record<string, string>;

export type ParsedApiError =
    | { kind: 'unauthorized'; message: string }
    | { kind: 'forbidden'; message: string }
    | { kind: 'validation'; message: string; fieldErrors?: UiFieldErrors }
    | { kind: 'not_found'; message: string }
    | { kind: 'internal'; message: string };

export type UiToastLevel = 'info' | 'success' | 'warning' | 'error';

export type UiAction =
    | { type: 'noop' }
    | { type: 'redirect'; to: string }
    | { type: 'showToast'; level: UiToastLevel; message: string }
    | { type: 'fieldErrors'; fields: UiFieldErrors };

export type ParsedApiErrorWithAction = ParsedApiError & { action: UiAction };

/**
 * 正規化された API エラーを UI 向けの形式に変換しています。
 */
export function parseApiErrorForUI(err: ApiError): ParsedApiErrorWithAction {
    const code = ((): string => {
        if (typeof err.code === 'string') return err.code.toLowerCase();
        if (typeof err.code === 'number') return String(err.code).toLowerCase();
        return '';
    })();
    const message = err.message || 'サーバーでエラーが発生しました';
    const extractFieldErrors = (): UiFieldErrors | undefined => {
        if (
            err.details
            && typeof err.details === 'object'
            && !Array.isArray(err.details)
        ) {
            const fieldErrors: UiFieldErrors = {};
            for (
                const [k, v] of Object.entries(
                    err.details as Record<string, unknown>,
                )
            ) {
                if (typeof v === 'string') fieldErrors[k] = v;
            }
            return Object.keys(fieldErrors).length ? fieldErrors : undefined;
        }
        return undefined;
    };

    if (
        code === 'unauthorized'
        || code === '401'
        || code === 'not_authenticated'
    ) {
        return {
            action: {
                level: 'warning',
                message: '認証が必要です。ログインしてください。',
                type: 'showToast',
            },
            kind: 'unauthorized',
            message,
        };
    }

    if (code === 'forbidden' || code === '403') {
        return {
            action: { level: 'error', message, type: 'showToast' },
            kind: 'forbidden',
            message,
        };
    }

    if (code === 'validation' || code === 'unprocessable' || code === '422') {
        const fieldErrors = extractFieldErrors();
        return {
            action: fieldErrors
                ? { fields: fieldErrors, type: 'fieldErrors' }
                : { level: 'error', message, type: 'showToast' },
            fieldErrors,
            kind: 'validation',
            message,
        };
    }

    if (code === 'not_found' || code === '404') {
        return {
            action: { level: 'info', message, type: 'showToast' },
            kind: 'not_found',
            message,
        };
    }
    return {
        action: { level: 'error', message, type: 'showToast' },
        kind: 'internal',
        message,
    };
}
