import { AddMusicSchema } from '@/shared/schemas/music';
import type { SubmissionResult } from '@conform-to/dom';
import { useForm } from '@conform-to/react';
import { parseWithZod } from '@conform-to/zod/v4';
import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { useMusicSubmissionFeedback } from './useMusicSubmissionFeedback';

interface FetcherData {
    status: 'success' | 'error';
    error?: string;
    [key: string]: unknown;
}

export function useMusicForm() {
    const fetcher = useFetcher();
    const lastStateRef = useRef(fetcher.state);
    const [retryAfter, setRetryAfter] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
        undefined,
    );

    useMusicSubmissionFeedback({ fetcher });

    const [form, fields] = useForm({
        lastResult: fetcher.data as SubmissionResult | null | undefined,
        onValidate: ({ formData }) => parseWithZod(formData, { schema: AddMusicSchema }),
        shouldRevalidate: 'onInput',
        shouldValidate: 'onBlur',
    });

    const isSubmitting = fetcher.state === 'submitting';
    const canSubmit = !fields.url.errors?.length && !isSubmitting;

    useEffect(() => {
        const wasSubmitting = lastStateRef.current !== 'idle';
        const isNowIdle = fetcher.state === 'idle';
        const data = fetcher.data as FetcherData | null | undefined;
        const errorMessage = typeof data?.error === 'string' ? data.error : undefined;

        if (wasSubmitting && isNowIdle && errorMessage) {
            const isRateLimitError = errorMessage.includes('レート制限');

            if (isRateLimitError) {
                const retryAfterHeader = (
                    fetcher.data as unknown as { headers?: Headers }
                ).headers;
                let seconds = 60;

                if (retryAfterHeader instanceof Headers) {
                    const retryValue = retryAfterHeader.get('Retry-After');
                    if (retryValue) {
                        const parsed = Number.parseInt(retryValue, 10);
                        if (!isNaN(parsed)) seconds = parsed;
                    }
                }

                if (retryAfter === 0) {
                    setRetryAfter(seconds);

                    clearInterval(intervalRef.current);
                    intervalRef.current = setInterval(() => {
                        setRetryAfter(prev => {
                            if (prev <= 1) {
                                clearInterval(intervalRef.current);
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);
                }
            }
        }

        lastStateRef.current = fetcher.state;
    }, [fetcher.state, fetcher.data, retryAfter]);

    useEffect(() => {
        return () => {
            clearInterval(intervalRef.current);
        };
    }, []);

    return {
        canSubmit,
        fetcher,
        fields,
        form,
        isSubmitting,
        retryAfter,
    };
}
