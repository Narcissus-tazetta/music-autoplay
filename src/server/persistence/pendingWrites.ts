import logger from '@/server/logger.server';

const DEFAULT_WARN_THRESHOLD = 100;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 300;

export interface PendingWriteRetry {
    attempts: number;
    baseDelayMs: number;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class PendingWriteQueue {
    private pending: Promise<unknown>[] = [];
    private tail: Promise<unknown> = Promise.resolve();

    /**
     * Writes are chained, so a retry holds back later writes instead of letting them overtake it.
     * Callers must pass idempotent writes (upsert / delete) and let errors propagate: a free-tier
     * Atlas cluster drops connections now and then, and a swallowed failure is data silently lost
     * on the next restart.
     */
    enqueue(write: () => Promise<unknown>): void {
        const task = this.tail.then(() => this.runWithRetry(write));
        this.tail = task.catch(error => {
            logger.error(`${this.label}: queued write failed`, { error });
        });
        this.track(this.tail);
    }

    constructor(
        private readonly label: string,
        private readonly warnThreshold: number = DEFAULT_WARN_THRESHOLD,
        private readonly retry: PendingWriteRetry = {
            attempts: DEFAULT_RETRY_ATTEMPTS,
            baseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
        },
    ) {}

    private async runWithRetry(write: () => Promise<unknown>): Promise<unknown> {
        for (let attempt = 1;; attempt++) {
            try {
                // eslint-disable-next-line no-await-in-loop
                return await write();
            } catch (error) {
                if (attempt >= this.retry.attempts) throw error;
                logger.warn(`${this.label}: write failed, retrying`, { attempt, error });
                // eslint-disable-next-line no-await-in-loop
                await sleep(this.retry.baseDelayMs * 2 ** (attempt - 1));
            }
        }
    }

    track(write: Promise<unknown>): void {
        this.pending.push(write);
        if (this.pending.length > this.warnThreshold) {
            logger.warn(`${this.label}: pending write queue is growing`, {
                pendingWrites: this.pending.length,
            });
        }
        void write.finally(() => {
            this.pending = this.pending.filter(x => x !== write);
        });
    }

    async settle(): Promise<void> {
        // Shutdown must include writes enqueued while an earlier batch was settling.
        // eslint-disable-next-line no-await-in-loop
        while (this.pending.length > 0) await Promise.allSettled(this.pending);
    }
}
