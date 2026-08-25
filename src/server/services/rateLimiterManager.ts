import logger from '../logger.server';
import type { RateLimiter } from './rateLimiter';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export class RateLimiterManager {
    private static instance: RateLimiterManager | undefined;
    private limiters = new Map<string, RateLimiter>();
    private cleanupTimerId: ReturnType<typeof setInterval> | undefined;

    private constructor() {}

    static getInstance(): RateLimiterManager {
        if (!RateLimiterManager.instance) RateLimiterManager.instance = new RateLimiterManager();
        return RateLimiterManager.instance;
    }

    register(name: string, limiter: RateLimiter): void {
        this.limiters.set(name, limiter);
    }

    getStats(): { name: string; totalKeys: number; totalAttempts: number }[] {
        const stats: { name: string; totalKeys: number; totalAttempts: number }[] = [];
        for (const [name, limiter] of this.limiters) {
            const limiterStats = limiter.getStats();
            stats.push({
                name,
                totalKeys: limiterStats.totalKeys,
                totalAttempts: limiterStats.totalAttempts,
            });
        }
        return stats;
    }

    reset(name: string, key: string): void {
        const limiter = this.limiters.get(name);
        if (limiter) limiter.clear(key);
    }

    /** Sweeps expired attempts on a fixed interval. Idempotent: a second call is a no-op. */
    scheduleCleanup(): void {
        if (this.cleanupTimerId !== undefined) return;

        this.cleanupTimerId = setInterval(() => {
            this.executeCleanup();
        }, SWEEP_INTERVAL_MS);
        // The sweep is housekeeping; it must not by itself keep the process alive.
        this.cleanupTimerId.unref?.();
    }

    stopCleanup(): void {
        if (this.cleanupTimerId !== undefined) {
            clearInterval(this.cleanupTimerId);
            this.cleanupTimerId = undefined;
        }
    }

    private executeCleanup(): void {
        const stats: { name: string; removedKeys: number; remainingKeys: number }[] = [];

        for (const [name, limiter] of this.limiters) {
            const removedKeys = limiter.sweep();
            stats.push({ name, remainingKeys: limiter.getStats().totalKeys, removedKeys });
        }

        if (stats.some(stat => stat.removedKeys > 0)) logger.debug('rate limiter sweep completed', { stats });
    }
}
