import { afterEach, beforeEach, describe, expect, it, test } from 'bun:test';
import { jest } from 'bun:test';

export { afterEach, beforeEach, describe, expect, it, test };
export const vi = {
    advanceTimersByTime: (ms: number) => (jest as any).advanceTimersByTime(ms),
    clearAllMocks: () => {
        jest.clearAllMocks();
    },
    clearAllTimers: () => (jest as any).clearAllTimers?.(),
    fn: (impl?: unknown) => jest.fn(impl as any),
    spyOn: (obj: unknown, method: string) => jest.spyOn(obj as any, method),
    useFakeTimers: () => {
        jest.useFakeTimers();
    },
    useRealTimers: () => {
        jest.useRealTimers();
    },
};
