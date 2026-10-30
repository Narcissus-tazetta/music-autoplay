import { PendingWriteQueue } from '../src/server/persistence/pendingWrites';
import { describe, expect, it } from './bunTestCompat';

const fastRetry = { attempts: 3, baseDelayMs: 1 };

describe('PendingWriteQueue retry', () => {
    it('retries a transiently failing write until it succeeds', async () => {
        const queue = new PendingWriteQueue('test', 100, fastRetry);
        let calls = 0;
        queue.enqueue(async () => {
            calls += 1;
            if (calls < 3) throw new Error('connection reset');
        });
        await queue.settle();
        expect(calls).toBe(3);
    });

    it('gives up after the configured attempts without blocking later writes', async () => {
        const queue = new PendingWriteQueue('test', 100, fastRetry);
        let failing = 0;
        const order: string[] = [];
        queue.enqueue(async () => {
            failing += 1;
            throw new Error('down');
        });
        queue.enqueue(async () => {
            order.push('second');
        });
        await queue.settle();
        expect(failing).toBe(3);
        expect(order).toEqual(['second']);
    });

    it('keeps write order while an earlier write is being retried', async () => {
        const queue = new PendingWriteQueue('test', 100, fastRetry);
        const order: string[] = [];
        let first = 0;
        queue.enqueue(async () => {
            first += 1;
            if (first === 1) throw new Error('blip');
            order.push('first');
        });
        queue.enqueue(async () => {
            order.push('second');
        });
        await queue.settle();
        expect(order).toEqual(['first', 'second']);
    });
});
