import { AdminRateLimiter } from '@/server/middleware/adminRateLimiter';
import { describe, expect, test } from 'bun:test';

describe('AdminRateLimiter', () => {
    test('locks after the configured number of failures', () => {
        const limiter = new AdminRateLimiter(3, 60_000);

        limiter.recordFailure('1.2.3.4');
        limiter.recordFailure('1.2.3.4');
        expect(limiter.isLocked('1.2.3.4')).toBe(false);

        limiter.recordFailure('1.2.3.4');
        expect(limiter.isLocked('1.2.3.4')).toBe(true);
        expect(limiter.getRetryAfterSeconds('1.2.3.4')).toBeGreaterThan(0);
    });

    test('keys are independent', () => {
        const limiter = new AdminRateLimiter(1, 60_000);

        limiter.recordFailure('1.2.3.4');

        expect(limiter.isLocked('1.2.3.4')).toBe(true);
        expect(limiter.isLocked('5.6.7.8')).toBe(false);
    });

    test('failures outside the window do not accumulate into a lockout', async () => {
        const limiter = new AdminRateLimiter(2, 60_000, 50);

        limiter.recordFailure('1.2.3.4');
        await new Promise(resolve => setTimeout(resolve, 80));
        limiter.recordFailure('1.2.3.4');

        expect(limiter.isLocked('1.2.3.4')).toBe(false);
    });

    test('forgets records that have gone quiet instead of holding them forever', async () => {
        const limiter = new AdminRateLimiter(5, 60_000, 50);
        const size = () => (limiter as unknown as { attempts: Map<string, unknown> }).attempts.size;

        limiter.recordFailure('stale');
        expect(size()).toBe(1);

        await new Promise(resolve => setTimeout(resolve, 80));
        limiter.recordFailure('fresh');

        expect(size()).toBe(1);
    });

    test('a successful login clears the record', () => {
        const limiter = new AdminRateLimiter(2, 60_000);

        limiter.recordFailure('1.2.3.4');
        limiter.recordSuccess('1.2.3.4');
        limiter.recordFailure('1.2.3.4');

        expect(limiter.isLocked('1.2.3.4')).toBe(false);
    });
});
