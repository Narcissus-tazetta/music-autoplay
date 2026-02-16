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

    scheduleCleanup(): void {
        const scheduleNext = (): void => {
            const now = Date.now();
            const nextCleanupTime = this.getNextCleanupTime(now);
            const delay = nextCleanupTime - now;

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

    private getNextCleanupTime(now: number): number {
        const d = new Date(now);
        const currentHour = d.getUTCHours();
        const nextCleanupHour = Math.ceil((currentHour + 1) / 6) * 6;

        if (nextCleanupHour >= 24) {
            return Date.UTC(
                d.getUTCFullYear(),
                d.getUTCMonth(),
                d.getUTCDate() + 1,
                0,
                0,
                0,
                0,
            );
        }

        return Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            nextCleanupHour,
            0,
            0,
            0,
        );
    }

    private getNextMidnightUTC(now: number): number {
        const d = new Date(now);
        return Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate() + 1,
            0,
            0,
            0,
            0,
        );
    }

    private executeCleanup(): void {
        try {
            const stats: { name: string; keys: number; attempts: number }[] = [];

            for (const [name, limiter] of this.limiters) {
                const before = limiter.getStats();
                limiter.clearAll();
                stats.push({
                    attempts: before.totalAttempts,
                    keys: before.totalKeys,
                    name,
                });
            }

            logger.info('Rate limiter cleanup completed', {
                stats,
                timestamp: new Date().toISOString(),
            });
        } catch (error: unknown) {
            logger.error('Rate limiter cleanup failed', { error });
        }
    }
}
