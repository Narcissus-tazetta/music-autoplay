import { describe, expect, test } from 'bun:test';
import { useFormErrors } from '../../src/app/hooks/useFormErrors';

describe('useFormErrors hook', () => {
    test('returns undefined when no error data', () => {
        const result = useFormErrors(undefined);
        expect(result.formErrorsString).toBeUndefined();
        expect(result.parsedAction).toBeUndefined();
    });

    test('returns undefined when success is true', () => {
        const result = useFormErrors({ data: {}, success: true });
        expect(result.formErrorsString).toBeUndefined();
        expect(result.parsedAction).toBeUndefined();
    });

    test('parses validation error with fieldErrors', () => {
        const fetcherData = {
            result: {
                error: {
                    code: 'VALIDATION',
                    details: {
                        url: 'URLが不正です',
                        title: 'タイトルが必要です',
                    },
                    message: 'バリデーションエラー',
                },
                success: false,
            },
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toContain('URLが不正です');
        expect(result.formErrorsString).toContain('タイトルが必要です');
        expect(result.parsedAction?.type).toBe('fieldErrors');
    });

    test('extracts message from non-validation error', () => {
        const fetcherData = {
            error: {
                code: 'NETWORK_ERROR',
                message: 'ネットワークエラーが発生しました',
            },
            success: false,
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toBe('ネットワークエラーが発生しました');
    });

    test('handles nested result structure', () => {
        const fetcherData = {
            result: {
                error: {
                    message: '内部エラー',
                },
                success: false,
            },
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toBe('内部エラー');
    });

    test('handles malformed error gracefully', () => {
        const fetcherData = {
            error: 'string error',
            success: false,
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toBeDefined();
    });

    test('returns action with toast when code is DUPLICATE_MUSIC', () => {
        const fetcherData = {
            error: {
                code: 'DUPLICATE_MUSIC',
                message: 'この楽曲は既に追加されています',
            },
            success: false,
        };

        const result = useFormErrors(fetcherData);
        expect(result.parsedAction?.type).toBe('showToast');
        expect(result.formErrorsString).toBe('この楽曲は既に追加されています');
    });

    test('extracts error from deeply nested structure', () => {
        const fetcherData = {
            result: {
                result: {
                    error: {
                        message: '深くネストされたエラー',
                    },
                    success: false,
                },
            },
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toBe('深くネストされたエラー');
    });
});
