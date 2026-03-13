import useFormErrors from '@/app/hooks/useFormErrors';
import { getMessage } from '@/shared/constants/messages';
import { useEffect, useRef, useState } from 'react';

interface FetcherLike {
    data: unknown;
    state: string;
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
    const [inlineFeedback, setInlineFeedback] = useState<MusicSubmissionInlineFeedback | null>(null);
    const { formErrorsString } = useFormErrors(fetcher.data);

    useEffect(() => {
        const wasSubmitting = lastStateRef.current !== 'idle';
        const isNowIdle = fetcher.state === 'idle';
        const data = fetcher.data as FetcherData | null | undefined;
        const errorMessage = typeof data?.error === 'string' ? data.error : undefined;
        const isSuccessReply = Boolean(data) && !errorMessage && !formErrorsString;

        if (wasSubmitting && isNowIdle && (data?.status === 'success' || isSuccessReply)) {
            setInlineFeedback({ message: '追加できました', tone: 'success' });
            if (!hasShownToastRef.current) {
                hasShownToastRef.current = true;
                void (async () => {
                    try {
                        const mod = await import('@/shared/utils/uiActionExecutor');
                        mod.executeUiAction({
                            level: 'success',
                            message: getMessage('SUCCESS_ADDED'),
                            type: 'showToast',
                        });
                    } catch (error) {
                        if (import.meta.env.DEV) console.debug('showToast failed', error);
                    }
                })();
            }
        }

        if (wasSubmitting && isNowIdle && errorMessage) {
            setInlineFeedback({ message: errorMessage, tone: 'error' });

            void (async () => {
                try {
                    const mod = await import('@/shared/utils/uiActionExecutor');
                    mod.executeUiAction({
                        level: 'error',
                        message: errorMessage,
                        type: 'showToast',
                    });
                } catch (error) {
                    if (import.meta.env.DEV) console.debug('showToast failed', error);
                }
            })();
        }

        if (wasSubmitting && isNowIdle && !errorMessage && formErrorsString) {
            setInlineFeedback({
                message: formErrorsString.includes('すでに') || formErrorsString.includes('登録されています')
                    ? '重複しています'
                    : formErrorsString,
                tone: 'error',
            });

            void (async () => {
                try {
                    const mod = await import('@/shared/utils/uiActionExecutor');
                    mod.executeUiAction({
                        level: 'error',
                        message: formErrorsString,
                        type: 'showToast',
                    });
                } catch (error) {
                    if (import.meta.env.DEV) console.debug('showToast failed', error);
                }
            })();
        }

        if (fetcher.state === 'submitting') {
            hasShownToastRef.current = false;
            setInlineFeedback(null);
        }

        lastStateRef.current = fetcher.state;
    }, [fetcher.data, fetcher.state, formErrorsString]);

    return inlineFeedback;
}
