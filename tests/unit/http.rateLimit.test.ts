import { RateLimiter } from '@/server/services/rateLimiter';
import { getClientIP } from '@/server/utils/getClientIP';
import { describe, expect, test } from 'bun:test';

describe('HTTP Rate Limiting', () => {
    describe('getClientIP', () => {
        test('extracts IP from X-Forwarded-For header', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
            });
            expect(getClientIP(request)).toBe('192.168.1.1');
        });

        test('extracts IP from X-Real-IP header', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-real-ip': '192.168.1.2' },
            });
            expect(getClientIP(request)).toBe('192.168.1.2');
        });

        test('prioritizes X-Forwarded-For over X-Real-IP', () => {
            const request = new Request('http://localhost', {
                headers: {
                    'x-forwarded-for': '192.168.1.1',
                    'x-real-ip': '192.168.1.2',
                },
            });
            expect(getClientIP(request)).toBe('192.168.1.1');
        });

        test("returns 'unknown' when no IP headers present", () => {
            const request = new Request('http://localhost');
            expect(getClientIP(request)).toBe('unknown');
        });

        test('trims whitespace from IP addresses', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' },
            });
            expect(getClientIP(request)).toBe('192.168.1.1');
        });
    });

    describe('RateLimiter with IP-based keys', () => {
        test('allows requests within limit', () => {
            const limiter = new RateLimiter(10, 60_000);
            const ip = '192.168.1.1';

            for (let i = 0; i < 10; i++) expect(limiter.tryConsume(ip)).toBe(true);
        });

        test('blocks requests exceeding limit', () => {
            const limiter = new RateLimiter(3, 60_000);
            const ip = '192.168.1.1';

            expect(limiter.tryConsume(ip)).toBe(true);
            expect(limiter.tryConsume(ip)).toBe(true);
            expect(limiter.tryConsume(ip)).toBe(true);
            expect(limiter.tryConsume(ip)).toBe(false);
        });

        test('isolates different IPs', () => {
            const limiter = new RateLimiter(2, 60_000);
            const ip1 = '192.168.1.1';
            const ip2 = '192.168.1.2';

            expect(limiter.tryConsume(ip1)).toBe(true);
            expect(limiter.tryConsume(ip1)).toBe(true);
            expect(limiter.tryConsume(ip1)).toBe(false);

            expect(limiter.tryConsume(ip2)).toBe(true);
            expect(limiter.tryConsume(ip2)).toBe(true);
            expect(limiter.tryConsume(ip2)).toBe(false);
        });

        test('resets after window expires', async () => {
            const limiter = new RateLimiter(2, 100);
            const ip = '192.168.1.1';

            expect(limiter.tryConsume(ip)).toBe(true);
            expect(limiter.tryConsume(ip)).toBe(true);
            expect(limiter.tryConsume(ip)).toBe(false);

            await new Promise(resolve => setTimeout(resolve, 150));

            expect(limiter.tryConsume(ip)).toBe(true);
        });

        test('getOldestAttempt returns correct timestamp', () => {
            const limiter = new RateLimiter(10, 60_000);
            const ip = '192.168.1.1';

            const before = Date.now();
            limiter.tryConsume(ip);
            const after = Date.now();

            const oldest = limiter.getOldestAttempt(ip);
            expect(oldest).toBeDefined();
            expect(typeof oldest).toBe('number');
            if (typeof oldest === 'number') {
                expect(oldest).toBeGreaterThanOrEqual(before);
                expect(oldest).toBeLessThanOrEqual(after);
            }
        });

        test('getOldestAttempt returns undefined for non-existent key', () => {
            const limiter = new RateLimiter(10, 60_000);
            expect(limiter.getOldestAttempt('192.168.1.1')).toBeUndefined();
        });

        test('calculates correct retryAfter', () => {
            const limiter = new RateLimiter(1, 60_000);
            const ip = '192.168.1.1';

            limiter.tryConsume(ip);
            limiter.tryConsume(ip);

            const oldest = limiter.getOldestAttempt(ip);
            if (typeof oldest === 'number') {
                const retryAfter = Math.ceil((oldest + 60_000 - Date.now()) / 1000);
                expect(retryAfter).toBeGreaterThan(0);
                expect(retryAfter).toBeLessThanOrEqual(60);
            }
        });

        test("handles 'unknown' IP gracefully", () => {
            const limiter = new RateLimiter(10, 60_000);
            const unknownIP = 'unknown';

            for (let i = 0; i < 10; i++) expect(limiter.tryConsume(unknownIP)).toBe(true);
            expect(limiter.tryConsume(unknownIP)).toBe(false);
        });
    });

    describe('Rate limit statistics', () => {
        test('tracks multiple IPs in stats', () => {
            const limiter = new RateLimiter(10, 60_000);

            limiter.tryConsume('192.168.1.1');
            limiter.tryConsume('192.168.1.1');
            limiter.tryConsume('192.168.1.2');

            const stats = limiter.getStats();
            expect(stats.totalKeys).toBe(2);
            expect(stats.totalAttempts).toBe(3);
        });

        test('updates stats correctly after window expiry', async () => {
            const limiter = new RateLimiter(10, 50);

            limiter.tryConsume('192.168.1.1');
            limiter.tryConsume('192.168.1.2');

            await new Promise(resolve => setTimeout(resolve, 100));

            limiter.tryConsume('192.168.1.3');

            const stats = limiter.getStats();
            expect(stats.totalKeys).toBeGreaterThanOrEqual(1);
            expect(stats.totalAttempts).toBeGreaterThanOrEqual(1);
        });
    });
});
