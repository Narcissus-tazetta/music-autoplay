import logger from '../logger';
import type { RateLimiter } from './rateLimiter';

export class RateLimiterManager {
    private static instance: RateLimiterManager | undefined;
    private limiters = new Map<string, RateLimiter>();
    private cleanupTimerId: ReturnType<typeof setTimeout> | undefined;

    private constructor() {}

    static getInstance(): RateLimiterManager {
        if (!RateLimiterManager.instance) RateLimiterManager.instance = new RateLimiterManager();
        return RateLimiterManager.instance;
    }

    register(name: string, limiter: RateLimiter): void {
        this.limiters.set(name, limiter);
    }

    reset(name: string, key: string): void {
        const limiter = this.limiters.get(name);
        if (limiter) limiter.clear(key);
    }

    scheduleCleanup(): void {
        const scheduleNext = (): void => {
            const now = Date.now();
            const nextMidnightUTC = this.getNextMidnightUTC(now);
            const delay = nextMidnightUTC - now;

            this.cleanupTimerId = setTimeout(() => {
                this.executeCleanup();
                scheduleNext();
            }, delay);
        };

        scheduleNext();
    }

    stopCleanup(): void {
        if (this.cleanupTimerId !== undefined) {
            clearTimeout(this.cleanupTimerId);
            this.cleanupTimerId = undefined;
        }
    }

    private getNextMidnightUTC(now: number): number {
        const d = new Date(now);
        const nextDay = Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate() + 1,
            0,
            0,
            0,
            0,
        );
        return nextDay;
    }

    private executeCleanup(): void {
        try {
            const stats: Array<{ name: string; keys: number; attempts: number }> = [];

            for (const [name, limiter] of this.limiters) {
                const before = limiter.getStats();
                limiter.clearAll();
                stats.push({
                    name,
                    keys: before.totalKeys,
                    attempts: before.totalAttempts,
                });
            }

            logger.info('Rate limiter cleanup completed', {
                timestamp: new Date().toISOString(),
                stats,
            });
        } catch (error: unknown) {
            logger.error('Rate limiter cleanup failed', { error });
        }
    }
}
