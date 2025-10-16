import { afterEach, beforeEach, describe, expect, it, test } from "bun:test";
import { jest } from "bun:test";

export { afterEach, beforeEach, describe, expect, it, test };
export const vi = {
  fn: (impl?: any) => jest.fn(impl),
  spyOn: (obj: any, method: string) => jest.spyOn(obj, method),
  useFakeTimers: () => {
    jest.useFakeTimers();
  },
  useRealTimers: () => {
    jest.useRealTimers();
  },
  advanceTimersByTime: (ms: number) => (jest as any).advanceTimersByTime(ms),
  clearAllTimers: () => (jest as any).clearAllTimers?.(),
  clearAllMocks: () => {
    jest.clearAllMocks();
  },
};
