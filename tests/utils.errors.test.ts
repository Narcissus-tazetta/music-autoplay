import { describe, expect, test } from 'bun:test';
import { isErr, isOk, safeExecuteAsync } from '../src/shared/utils/errors/result-handlers';

describe('result-handlers utilities', () => {
    describe('safeExecuteAsync', () => {
        test('returns ok result for successful async execution', async () => {
            const result = await safeExecuteAsync(async () => 42);
            expect(isOk(result)).toBe(true);
            if (isOk(result)) expect(result.value).toBe(42);
        });

        test('returns error result when async function throws', async () => {
            const result = await safeExecuteAsync(async () => {
                throw new Error('async error');
            });
            expect(isErr(result)).toBe(true);
            if (isErr(result)) expect(result.error.message).toBe('async error');
        });

        test('handles promise rejection', async () => {
            const result = await safeExecuteAsync(() => Promise.reject(new Error('rejected')));
            expect(isErr(result)).toBe(true);
        });
    });

    describe('isOk and isErr type guards', () => {
        test('isOk correctly identifies ok result', () => {
            const result = { ok: true, value: 42 } as const;
            expect(isOk(result)).toBe(true);
            expect(isErr(result)).toBe(false);
        });

        test('isErr correctly identifies error result', () => {
            const result = { error: new Error(), ok: false } as const;
            expect(isOk(result)).toBe(false);
            expect(isErr(result)).toBe(true);
        });
    });
});
