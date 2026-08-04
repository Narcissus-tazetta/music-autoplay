import type { ParsedApiErrorWithAction, UiAction } from '@/shared/utils/apiUi';
import type { UiActionExecutorOptions } from '@/shared/utils/uiActionExecutor';

/**
 * Fire-and-forget wrappers around the UI action executor.
 *
 * The executor pulls in the conform adapter and window plumbing, so it stays behind a
 * dynamic import and out of the initial bundle — the type-only import above is erased at
 * build time and does not undo that split. Callers used to repeat this import-and-swallow
 * dance at seven separate sites; a failure here must never escalate, since these only
 * drive toasts and redirects.
 */
const loadExecutor = () => import('@/shared/utils/uiActionExecutor');

export async function runUiAction(
    action: UiAction,
    opts?: UiActionExecutorOptions,
): Promise<void> {
    try {
        const mod = await loadExecutor();
        mod.executeUiAction(action, opts);
    } catch (error) {
        if (import.meta.env.DEV) console.debug('runUiAction failed', { action, error });
    }
}

export async function runParsedApiError(
    parsed: ParsedApiErrorWithAction,
    opts?: UiActionExecutorOptions,
): Promise<void> {
    try {
        const mod = await loadExecutor();
        mod.executeParsedApiError(parsed, opts);
    } catch (error) {
        if (import.meta.env.DEV) console.debug('runParsedApiError failed', { error, parsed });
    }
}
