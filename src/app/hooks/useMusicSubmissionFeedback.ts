import useFormErrors from '@/app/hooks/useFormErrors';
import { getMessage } from '@/shared/constants/messages';
import { runUiAction } from '@/shared/utils/runUiAction';
import { useEffect, useRef, useState } from 'react';

interface FetcherLike {
    data: unknown;
    state: string;
    formAction?: string;
}

interface FetcherData {
    status: 'success' | 'error';
    error?: string;
    [key: string]: unknown;
}

interface UseMusicSubmissionFeedbackOptions {
    fetcher: FetcherLike;
}

interface MusicSubmissionInlineFeedback {
    message: string;
    tone: 'success' | 'error';
}

export function useMusicSubmissionFeedback({
    fetcher,
}: UseMusicSubmissionFeedbackOptions): MusicSubmissionInlineFeedback | null {
    const hasShownToastRef = useRef(false);
    const lastStateRef = useRef(fetcher.state);
    const actionRef = useRef(fetcher.formAction);
    const [inlineFeedback, setInlineFeedback] = useState<MusicSubmissionInlineFeedback | null>(null);
    const { formErrorsString } = useFormErrors(fetcher.data);

    useEffect(() => {
        const wasSubmitting = lastStateRef.current !== 'idle';
        const isNowIdle = fetcher.state === 'idle';
        const data = fetcher.data as FetcherData | null | undefined;
        const errorMessage = typeof data?.error === 'string' ? data.error : undefined;
        const isSuccessReply = Boolean(data) && !errorMessage && !formErrorsString;

        if (wasSubmitting && isNowIdle && (data?.status === 'success' || isSuccessReply)) {
            const message = actionRef.current?.endsWith('/music/remove')
                ? '削除できました'
                : getMessage('SUCCESS_ADDED');
            setInlineFeedback({ message, tone: 'success' });
            if (!hasShownToastRef.current) {
                hasShownToastRef.current = true;
                void runUiAction({
                    level: 'success',
                    message,
                    type: 'showToast',
                });
            }
        }

        if (wasSubmitting && isNowIdle && errorMessage) {
            setInlineFeedback({ message: errorMessage, tone: 'error' });

            void runUiAction({ level: 'error', message: errorMessage, type: 'showToast' });
        }

        if (wasSubmitting && isNowIdle && !errorMessage && formErrorsString) {
            setInlineFeedback({
                message: formErrorsString.includes('すでに') || formErrorsString.includes('登録されています')
                    ? '重複しています'
                    : formErrorsString,
                tone: 'error',
            });

            void runUiAction({ level: 'error', message: formErrorsString, type: 'showToast' });
        }

        if (fetcher.state === 'submitting') {
            actionRef.current = fetcher.formAction;
            hasShownToastRef.current = false;
            setInlineFeedback(null);
        }

        lastStateRef.current = fetcher.state;
    }, [fetcher.data, fetcher.formAction, fetcher.state, formErrorsString]);

    return inlineFeedback;
}
