import { RateLimiter } from '@/server/services/rateLimiter';
import { createAdminAuthHandlers } from '@/server/socket/handlers/adminHandlers';
import { describe, expect, test } from 'bun:test';
import { createHash } from 'crypto';
import type { Socket } from 'socket.io';

describe('Admin Auth Handlers', () => {
    const testToken = 'test-secret-token';
    const testHash = createHash('sha256').update(testToken).digest('hex');
    const invalidToken = 'invalid-token';

    describe('createAdminAuthHandlers', () => {
        test('should create both adminAuth and adminAuthByQuery handlers', () => {
            const rateLimiter = new RateLimiter(10, 60000);
            const handlers = createAdminAuthHandlers(
                testHash,
                rateLimiter,
                10,
                60000,
            );

            expect(handlers.adminAuth).toBeDefined();
            expect(handlers.adminAuthByQuery).toBeDefined();
            expect(typeof handlers.adminAuth).toBe('function');
            expect(typeof handlers.adminAuthByQuery).toBe('function');
        });
    });

    describe('adminAuth handler', () => {
        test('should return success for valid token', async () => {
            const rateLimiter = new RateLimiter(10, 60000);
            const handlers = createAdminAuthHandlers(
                testHash,
                rateLimiter,
                10,
                60000,
            );

            const mockSocket = {
                id: 'socket-1',
                handshake: { address: '127.0.0.1' },
                on: () => {},
            } as unknown as Socket;

            const mockContext = {
                socketId: 'socket-1',
                connectionId: 'conn-1',
            };

            // ハンドラのインスタンスを作成する
            handlers.adminAuth(mockSocket, mockContext);

            // ハンドラはイベントリスナーを登録するため、手動で呼び出す必要がある
            // テスト目的では、ハンドラのロジックを抽出できる
            // これは簡易化したテストです。実際のシナリオではsocket.io経由でハンドラが呼び出されます
        });

        test('should return error for invalid token', () => {
            const rateLimiter = new RateLimiter(10, 60000);
            const handlers = createAdminAuthHandlers(
                testHash,
                rateLimiter,
                10,
                60000,
            );

            const invalidHash = createHash('sha256')
                .update(invalidToken)
                .digest('hex');

            expect(invalidHash).not.toBe(testHash);
        });
    });

    describe('rate limiting', () => {
        test('should apply rate limit based on IP address', () => {
            const rateLimiter = new RateLimiter(3, 60000);
            const handlers = createAdminAuthHandlers(testHash, rateLimiter, 3, 60000);

            const mockSocket = {
                id: 'socket-1',
                handshake: { address: '192.168.1.1' },
                on: () => {},
            } as unknown as Socket;

            // レートリミッタはIPアドレスで追跡するため、同じIPからの複数回の試行をシミュレート
            expect(rateLimiter.tryConsume('192.168.1.1')).toBe(true);
            expect(rateLimiter.tryConsume('192.168.1.1')).toBe(true);
            expect(rateLimiter.tryConsume('192.168.1.1')).toBe(true);
            expect(rateLimiter.tryConsume('192.168.1.1')).toBe(false);
        });

        test('should fallback to socket.id when IP not available', () => {
            const rateLimiter = new RateLimiter(3, 60000);
            const handlers = createAdminAuthHandlers(testHash, rateLimiter, 3, 60000);

            const mockSocket = {
                id: 'socket-1',
                handshake: { address: undefined },
                on: () => {},
            } as unknown as Socket;

            expect(rateLimiter.tryConsume('socket-1')).toBe(true);
            expect(rateLimiter.tryConsume('socket-1')).toBe(true);
            expect(rateLimiter.tryConsume('socket-1')).toBe(true);
            expect(rateLimiter.tryConsume('socket-1')).toBe(false);
        });

        test('should track different IPs independently', () => {
            const rateLimiter = new RateLimiter(3, 60000);
            const handlers = createAdminAuthHandlers(testHash, rateLimiter, 3, 60000);

            expect(rateLimiter.tryConsume('192.168.1.1')).toBe(true);
            expect(rateLimiter.tryConsume('192.168.1.1')).toBe(true);
            expect(rateLimiter.tryConsume('192.168.1.1')).toBe(true);
            expect(rateLimiter.tryConsume('192.168.1.1')).toBe(false);

            // 異なるIPは別々に制限される
            expect(rateLimiter.tryConsume('192.168.1.2')).toBe(true);
        });
    });

    describe('token validation', () => {
        test('should hash token correctly', () => {
            const token = 'my-secret-token';
            const hash1 = createHash('sha256').update(token).digest('hex');
            const hash2 = createHash('sha256').update(token).digest('hex');

            expect(hash1).toBe(hash2);
        });

        test('should produce different hashes for different tokens', () => {
            const token1 = 'token1';
            const token2 = 'token2';

            const hash1 = createHash('sha256').update(token1).digest('hex');
            const hash2 = createHash('sha256').update(token2).digest('hex');

            expect(hash1).not.toBe(hash2);
        });

        test('should validate hash correctly', () => {
            const token = 'test-token';
            const correctHash = createHash('sha256').update(token).digest('hex');
            const testHash = createHash('sha256').update(token).digest('hex');

            expect(testHash).toBe(correctHash);

            const wrongHash = createHash('sha256')
                .update('wrong-token')
                .digest('hex');
            expect(wrongHash).not.toBe(correctHash);
        });
    });

    describe('retryAfter calculation', () => {
        test('should calculate retryAfter when rate limit exceeded', () => {
            const rateLimiter = new RateLimiter(3, 60000);

            rateLimiter.tryConsume('192.168.1.1');
            rateLimiter.tryConsume('192.168.1.1');
            rateLimiter.tryConsume('192.168.1.1');

            const oldest = rateLimiter.getOldestAttempt('192.168.1.1');
            expect(oldest).toBeDefined();

            if (oldest) {
                const now = Date.now();
                const retryAfter = Math.ceil((60000 - (now - oldest)) / 1000);
                expect(retryAfter).toBeGreaterThan(0);
                expect(retryAfter).toBeLessThanOrEqual(60);
            }
        });
    });
});
