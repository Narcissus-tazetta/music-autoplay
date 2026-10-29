import { expect, test } from 'bun:test';
import type { Socket } from 'socket.io';
import { RateLimiter } from '../src/server/services/rateLimiter';
import { createSocketEventHandler } from '../src/server/socket/handlers/eventHandler';

test('shared requester budget blocks concurrent work across connections and events', async () => {
    const limiter = new RateLimiter(1, 60_000);
    let started = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
        release = resolve;
    });
    const register = (event: string) => {
        let handler!: (...args: unknown[]) => Promise<void>;
        const socket = {
            id: event,
            on: (_event: string, fn: typeof handler) => {
                handler = fn;
            },
        } as unknown as Socket;
        createSocketEventHandler({
            event,
            rateLimiter: { maxAttempts: 1, windowMs: 60_000, keyGenerator: () => 'same-user' },
            sharedRateLimiter: limiter,
            handler: async () => {
                started++;
                await gate;
                return {};
            },
        })(socket);
        return handler;
    };
    const add = register('add');
    const remove = register('remove');
    const first = add({});
    try {
        await remove({});
        expect(started).toBe(1);
    } finally {
        release();
        await first;
    }
});
