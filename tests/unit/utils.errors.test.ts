import { describe, expect, test } from 'bun:test';
import {
    chainResult,
    combineResults,
    isErr,
    isOk,
    mapResult,
    safeExecute,
    safeExecuteAsync,
} from '../../src/shared/utils/errors/result-handlers';

describe('result-handlers utilities', () => {
    describe('safeExecute', () => {
        test('returns ok result for successful execution', () => {
            const result = safeExecute(() => 42);
            expect(isOk(result)).toBe(true);
            if (isOk(result)) expect(result.value).toBe(42);
        });

        test('returns error result when function throws', () => {
            const result = safeExecute(() => {
                throw new Error('test error');
            });
            expect(isErr(result)).toBe(true);
            if (isErr(result)) expect(result.error.message).toBe('test error');
        });

        test('handles non-error throws', () => {
            const result = safeExecute(() => {
                throw new Error('string error');
            });
            expect(isErr(result)).toBe(true);
        });
    });

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

    describe('mapResult', () => {
        test('maps ok result value', () => {
            const result = { ok: true, value: 10 } as const;
            const mapped = mapResult(result, v => v * 2);
            expect(isOk(mapped)).toBe(true);
            if (isOk(mapped)) expect(mapped.value).toBe(20);
        });

        test('passes through error result', () => {
            const error = new Error('test');
            const result = { error, ok: false } as const;
            const mapped = mapResult(result, (v: number) => v * 2);
            expect(isErr(mapped)).toBe(true);
            if (isErr(mapped)) expect(mapped.error).toBe(error);
        });
    });

    describe('chainResult', () => {
        test('chains ok result to next operation', () => {
            const result = { ok: true, value: 10 } as const;
            const chained = chainResult(
                result,
                (v: number) => ({ ok: true, value: v * 2 }) as const,
            );
            expect(isOk(chained)).toBe(true);
            if (isOk(chained)) expect(chained.value).toBe(20);
        });

        test('stops chain on error', () => {
            const error = new Error('test');
            const result = { error, ok: false } as const;
            const chained = chainResult(
                result,
                (v: number) => ({ ok: true, value: v * 2 }) as const,
            );
            expect(isErr(chained)).toBe(true);
            if (isErr(chained)) expect(chained.error).toBe(error);
        });

        test('propagates error from chain operation', () => {
            const result = { ok: true, value: 10 } as const;
            const error = new Error('chain error');
            const chained = chainResult(result, () => ({ error, ok: false }));
            expect(isErr(chained)).toBe(true);
            if (isErr(chained)) expect(chained.error).toBe(error);
        });
    });

    describe('combineResults', () => {
        test('combines all ok results', () => {
            const results: { ok: true; value: number }[] = [
                { ok: true, value: 1 },
                { ok: true, value: 2 },
                { ok: true, value: 3 },
            ];
            const combined = combineResults(results);
            expect(isOk(combined)).toBe(true);
            if (isOk(combined)) expect(combined.value).toEqual([1, 2, 3]);
        });

        test('returns first error when any result fails', () => {
            const error = new Error('test');
            const results: ({ ok: true; value: number } | { ok: false; error: Error })[] = [
                { ok: true, value: 1 },
                { error, ok: false },
                { ok: true, value: 3 },
            ];
            const combined = combineResults(results);
            expect(isErr(combined)).toBe(true);
            if (isErr(combined)) expect(combined.error).toBe(error);
        });

        test('handles empty array', () => {
            const combined = combineResults([]);
            expect(isOk(combined)).toBe(true);
            if (isOk(combined)) expect(combined.value).toEqual([]);
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
