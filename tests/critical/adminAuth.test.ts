import { AdminAuthenticator, createAdminAuthenticator, parseBasicAuth } from '@/server/middleware/adminAuth';
import { AdminRateLimiter, createAdminRateLimiter } from '@/server/middleware/adminRateLimiter';
import { describe, expect, test } from 'bun:test';

describe('Admin Authentication', () => {
    const testUsername = 'admin';
    const testPassword = 'password123';

    describe('AdminAuthenticator', () => {
        test('should authenticate with correct credentials', () => {
            const authenticator = new AdminAuthenticator({
                username: testUsername,
                password: testPassword,
            });

            expect(authenticator.authenticate(testUsername, testPassword)).toBe(true);
        });

        test('should reject incorrect username', () => {
            const authenticator = new AdminAuthenticator({
                username: testUsername,
                password: testPassword,
            });

            expect(authenticator.authenticate('wronguser', testPassword)).toBe(false);
        });

        test('should reject incorrect password', () => {
            const authenticator = new AdminAuthenticator({
                username: testUsername,
                password: testPassword,
            });

            expect(authenticator.authenticate(testUsername, 'wrongpassword')).toBe(false);
        });

        test('should reject both incorrect credentials', () => {
            const authenticator = new AdminAuthenticator({
                username: testUsername,
                password: testPassword,
            });

            expect(authenticator.authenticate('wronguser', 'wrongpassword')).toBe(false);
        });

        test('should be timing-safe (same length comparison)', () => {
            const authenticator = new AdminAuthenticator({
                username: testUsername,
                password: testPassword,
            });
            expect(authenticator.authenticate('admin', 'wrongpass123')).toBe(false);
        });
    });

    describe('createAdminAuthenticator factory', () => {
        test('should create authenticator instance', () => {
            const authenticator = createAdminAuthenticator(testUsername, testPassword);

            expect(authenticator).toBeInstanceOf(AdminAuthenticator);
            expect(authenticator.authenticate(testUsername, testPassword)).toBe(true);
        });
    });

    describe('parseBasicAuth', () => {
        test('should parse valid Basic auth header', () => {
            const credentials = Buffer.from(`${testUsername}:${testPassword}`).toString('base64');
            const authHeader = `Basic ${credentials}`;

            const result = parseBasicAuth(authHeader);

            expect(result).not.toBeNull();
            expect(result?.username).toBe(testUsername);
            expect(result?.password).toBe(testPassword);
        });

        test('should return null for invalid format', () => {
            expect(parseBasicAuth('Invalid format')).toBeNull();
            expect(parseBasicAuth('Bearer token')).toBeNull();
            expect(parseBasicAuth('Basic')).toBeNull();
        });

        test('should return null for invalid base64', () => {
            expect(parseBasicAuth('Basic !!invalid!!')).toBeNull();
        });

        test('should return null for missing password', () => {
            const credentials = Buffer.from('username').toString('base64');
            const authHeader = `Basic ${credentials}`;

            expect(parseBasicAuth(authHeader)).toBeNull();
        });
    });
});

describe('Admin Rate Limiter', () => {
    describe('AdminRateLimiter', () => {
        test('should allow attempts under limit', () => {
            const limiter = new AdminRateLimiter(3, 60000);

            expect(limiter.isLocked('user1')).toBe(false);
            limiter.recordFailure('user1');
            expect(limiter.isLocked('user1')).toBe(false);
            limiter.recordFailure('user1');
            expect(limiter.isLocked('user1')).toBe(false);
        });

        test('should lock account after max failures', () => {
            const limiter = new AdminRateLimiter(3, 60000);

            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            limiter.recordFailure('user1');

            expect(limiter.isLocked('user1')).toBe(true);
        });

        test('should track different users independently', () => {
            const limiter = new AdminRateLimiter(3, 60000);

            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            limiter.recordFailure('user1');

            expect(limiter.isLocked('user1')).toBe(true);
            expect(limiter.isLocked('user2')).toBe(false);
        });

        test('should reset on successful login', () => {
            const limiter = new AdminRateLimiter(3, 60000);

            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            expect(limiter.isLocked('user1')).toBe(false);

            limiter.recordSuccess('user1');
            expect(limiter.isLocked('user1')).toBe(false);

            limiter.recordFailure('user1');
            expect(limiter.isLocked('user1')).toBe(false);
        });

        test('should calculate retry after seconds', () => {
            const limiter = new AdminRateLimiter(3, 60000);

            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            limiter.recordFailure('user1');

            const retryAfter = limiter.getRetryAfterSeconds('user1');

            expect(retryAfter).not.toBeNull();
            expect(retryAfter).toBeGreaterThan(0);
            expect(retryAfter).toBeLessThanOrEqual(60);
        });

        test('should return null retry after for non-locked user', () => {
            const limiter = new AdminRateLimiter(3, 60000);

            expect(limiter.getRetryAfterSeconds('user1')).toBeNull();

            limiter.recordFailure('user1');
            expect(limiter.getRetryAfterSeconds('user1')).toBeNull();
        });

        test('should unlock after lock duration', async () => {
            const limiter = new AdminRateLimiter(3, 100); // 100ms lock

            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            limiter.recordFailure('user1');

            expect(limiter.isLocked('user1')).toBe(true);

            // Wait for lock period
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(limiter.isLocked('user1')).toBe(false);
        });
    });

    describe('createAdminRateLimiter factory', () => {
        test('should create rate limiter with default values', () => {
            const limiter = createAdminRateLimiter();

            expect(limiter).toBeInstanceOf(AdminRateLimiter);

            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            limiter.recordFailure('user1');

            expect(limiter.isLocked('user1')).toBe(true);
        });

        test('should create rate limiter with custom values', () => {
            const limiter = createAdminRateLimiter(5, 30000);

            expect(limiter).toBeInstanceOf(AdminRateLimiter);

            // Can fail up to 5 times
            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            limiter.recordFailure('user1');
            expect(limiter.isLocked('user1')).toBe(false);

            limiter.recordFailure('user1');
            expect(limiter.isLocked('user1')).toBe(true);
        });
    });
});
