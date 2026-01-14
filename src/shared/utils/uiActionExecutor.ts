import { getWindowExtensions } from '@/shared/schemas/global';
import type { ParsedApiErrorWithAction, UiAction } from '@/shared/utils/apiUi';
import { applyFieldErrorsToConform } from '@/shared/utils/formAdapters/conformAdapter';

const tryShowToast = (level: string, message: string): void => {
    try {
        const winResult = getWindowExtensions();
        if (winResult?.success) {
            const showToast = winResult.data.__app__?.showToast;
            if (typeof showToast === 'function') {
                showToast({ level: level as any, message });
                return;
            }
        }
    } catch {
        // Window extensions not available, fallback to console
    }

    if (import.meta.env.DEV) console.warn(`TOAST[${level}]: ${message}`);
};

const tryRedirect = (to: string): void => {
    try {
        const winResult = getWindowExtensions();
        if (winResult?.success) {
            const navigate = winResult.data.__app__?.navigate;
            if (typeof navigate === 'function') {
                navigate(to);
                return;
            }
        }
    } catch {
        // Window extensions not available, fallback to location.href
    }
    window.location.href = to;
};

export interface UiActionExecutorOptions {
    conformFields?: Record<string, unknown> | undefined;
}

export function executeUiAction(
    action: UiAction,
    opts?: UiActionExecutorOptions,
): void {
    switch (action.type) {
        case 'noop': {
            return;
        }
        case 'redirect': {
            tryRedirect(action.to);
            return;
        }
        case 'showToast': {
            tryShowToast(action.level, action.message);
            return;
        }
        case 'fieldErrors': {
            try {
                if (opts?.conformFields) {
                    const maybeFields = opts.conformFields;
                    const looksLikeConform = Object.values(maybeFields).every(v => {
                        return (
                            v
                            && typeof v === 'object'
                            && 'name' in (v as Record<string, unknown>)
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
                tryShowToast('error', Object.values(action.fields).join(' '));
            } catch {
                if (import.meta.env.DEV) console.debug('uiActionExecutor action failed');
            }
            return;
        }
        default: {
            return;
        }
    }
}

export function executeParsedApiError(
    parsed: ParsedApiErrorWithAction,
    opts?: UiActionExecutorOptions,
): void {
    executeUiAction(parsed.action, opts);
}
