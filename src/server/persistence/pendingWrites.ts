import logger from '@/server/logger.server';

const DEFAULT_WARN_THRESHOLD = 100;

export class PendingWriteQueue {
    private pending: Promise<unknown>[] = [];
    private tail: Promise<unknown> = Promise.resolve();

    enqueue(write: () => Promise<unknown>): void {
        const task = this.tail.then(write);
        this.tail = task.catch(error => {
            logger.error(`${this.label}: queued write failed`, { error });
        });
        this.track(this.tail);
    }

    constructor(
        private readonly label: string,
        private readonly warnThreshold: number = DEFAULT_WARN_THRESHOLD,
    ) {}

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
