import logger from '@/server/logger';

const DEFAULT_WARN_THRESHOLD = 100;

/**
 * Bookkeeping for the background writes a hybrid store fires off after mutating memory.
 *
 * MongoHybridStore, HistoryMongoHybridStore and RequestLogMongoHybridStore each kept their
 * own copy of the same push / finally-filter dance in six places, which is easy to get
 * subtly wrong: forget the `finally` and the array grows without bound, forget to compare
 * by identity and you drop the wrong entry.
 *
 * Callers attach their own `.catch()` before tracking, so a tracked promise never rejects;
 * `settle()` uses allSettled regardless so a caller that forgets cannot break flush().
 */
export class PendingWriteQueue {
    private pending: Promise<unknown>[] = [];

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

    /**
     * Waits for every write tracked so far to settle. Never rejects.
     *
     * Writes started while this is awaiting are not covered - the array is read once, which
     * matches what the three hybrid stores did before this class existed.
     */
    async settle(): Promise<void> {
        await Promise.allSettled(this.pending);
    }
}
