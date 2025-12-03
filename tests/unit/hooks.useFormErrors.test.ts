import { describe, expect, test } from 'bun:test';
import { useFormErrors } from '../../src/app/hooks/useFormErrors';

describe('useFormErrors hook', () => {
    test('returns undefined when no error data', () => {
        const result = useFormErrors(null);
        expect(result.formErrorsString).toBeUndefined();
        expect(result.parsedAction).toBeUndefined();
    });

    test('returns undefined when success is true', () => {
        const result = useFormErrors({ success: true, data: {} });
        expect(result.formErrorsString).toBeUndefined();
        expect(result.parsedAction).toBeUndefined();
    });

    test('parses validation error with fieldErrors', () => {
        const fetcherData = {
            result: {
                success: false,
                error: {
                    code: 'VALIDATION',
                    message: 'バリデーションエラー',
                    details: {
                        url: 'URLが不正です',
                        title: 'タイトルが必要です',
                    },
                },
            },
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toContain('URLが不正です');
        expect(result.formErrorsString).toContain('タイトルが必要です');
        expect(result.parsedAction?.type).toBe('fieldErrors');
    });

    test('extracts message from non-validation error', () => {
        const fetcherData = {
            success: false,
            error: {
                code: 'NETWORK_ERROR',
                message: 'ネットワークエラーが発生しました',
            },
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toBe('ネットワークエラーが発生しました');
    });

    test('handles nested result structure', () => {
        const fetcherData = {
            result: {
                success: false,
                error: {
                    message: '内部エラー',
                },
            },
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toBe('内部エラー');
    });

    test('handles malformed error gracefully', () => {
        const fetcherData = {
            success: false,
            error: 'string error',
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toBeDefined();
    });

    test('returns action with toast when code is DUPLICATE_MUSIC', () => {
        const fetcherData = {
            success: false,
            error: {
                code: 'DUPLICATE_MUSIC',
                message: 'この楽曲は既に追加されています',
            },
        };

        const result = useFormErrors(fetcherData);
        expect(result.parsedAction?.type).toBe('showToast');
        expect(result.formErrorsString).toBe('この楽曲は既に追加されています');
    });

    test('extracts error from deeply nested structure', () => {
        const fetcherData = {
            result: {
                result: {
                    success: false,
                    error: {
                        message: '深くネストされたエラー',
                    },
                },
            },
        };

        const result = useFormErrors(fetcherData);
        expect(result.formErrorsString).toBe('深くネストされたエラー');
    });
});
