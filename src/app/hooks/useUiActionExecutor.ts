import type { UiAction } from '@/shared/utils/apiUi';
import { useEffect, useRef } from 'react';

interface UseUiActionExecutorOptions {
    parsedAction: UiAction | null | undefined;
    conformFields: unknown;
}

export function useUiActionExecutor({
    parsedAction,
    conformFields,
}: UseUiActionExecutorOptions): void {
    const lastParsedActionRef = useRef<UiAction | null | undefined>(null);
    const hasExecutedRef = useRef(false);

    useEffect(() => {
        if (!parsedAction) {
            if (lastParsedActionRef.current !== null) {
                lastParsedActionRef.current = undefined;
                hasExecutedRef.current = false;
            }
            return;
        }
        if (parsedAction === lastParsedActionRef.current && hasExecutedRef.current) return;

        lastParsedActionRef.current = parsedAction;
        hasExecutedRef.current = true;

        void (async () => {
            try {
                const mod = await import('@/shared/utils/uiActionExecutor');
                try {
                    mod.executeUiAction(parsedAction, {
                        conformFields: conformFields as Record<string, unknown> | undefined,
                    });
                } catch (error) {
                    if (import.meta.env.DEV) console.debug('uiActionExecutor.executeUiAction failed', error);
                }
            } catch (error) {
                if (import.meta.env.DEV) console.debug('dynamic import uiActionExecutor failed', error);
            }
        })();
    }, [parsedAction, conformFields]);
}
