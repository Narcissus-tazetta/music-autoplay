import type { UiAction } from '@/shared/utils/apiUi';
import { runUiAction } from '@/shared/utils/runUiAction';
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

        void runUiAction(parsedAction, {
            conformFields: conformFields as Record<string, unknown> | undefined,
        });
    }, [parsedAction, conformFields]);
}
