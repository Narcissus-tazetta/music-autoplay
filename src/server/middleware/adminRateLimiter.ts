interface AttemptRecord {
    fails: number;
    lastFailureAt: number;
    lockedUntil?: number;
}

/**
 * Lockout for repeated failed admin logins, keyed by client address.
 *
 * Failures age out after `failureWindowMs`, so a stray failure today plus one next week does
 * not add up to a lockout, and records that have gone quiet are dropped rather than kept for
 * the process's lifetime.
 */
export class AdminRateLimiter {
    private attempts = new Map<string, AttemptRecord>();
    private readonly maxFails: number;
    private readonly lockDurationMs: number;
    private readonly failureWindowMs: number;

    constructor(maxFails = 3, lockDurationMs = 60000, failureWindowMs = 15 * 60 * 1000) {
        this.maxFails = maxFails;
        this.lockDurationMs = lockDurationMs;
        this.failureWindowMs = failureWindowMs;
    }

    private isStale(record: AttemptRecord, now: number): boolean {
        if (record.lockedUntil) return now >= record.lockedUntil;
        return now - record.lastFailureAt >= this.failureWindowMs;
    }

    private prune(now: number): void {
        for (const [key, record] of this.attempts) if (this.isStale(record, now)) this.attempts.delete(key);
    }

    isLocked(key: string): boolean {
        const record = this.attempts.get(key);
        if (!record) return false;

        const now = Date.now();
        if (record.lockedUntil && now < record.lockedUntil) return true;

        if (this.isStale(record, now)) this.attempts.delete(key);
        return false;
    }

    recordFailure(key: string): void {
        const now = Date.now();
        // Admin logins are rare enough that sweeping the whole map on each failure is cheaper
        // than carrying a separate timer for it.
        this.prune(now);

        const existing = this.attempts.get(key);
        const record: AttemptRecord = existing ?? { fails: 0, lastFailureAt: now };
        record.fails += 1;
        record.lastFailureAt = now;

        if (record.fails >= this.maxFails) record.lockedUntil = now + this.lockDurationMs;

        this.attempts.set(key, record);
    }

    recordSuccess(key: string): void {
        this.attempts.delete(key);
    }

    getRetryAfterSeconds(key: string): number | null {
        const record = this.attempts.get(key);
        if (!record || !record.lockedUntil) return null;

        const now = Date.now();
        if (now >= record.lockedUntil) return null;

        return Math.ceil((record.lockedUntil - now) / 1000);
    }
}

export function createAdminRateLimiter(
    maxFails = 3,
    lockDurationMs = 60000,
): AdminRateLimiter {
    return new AdminRateLimiter(maxFails, lockDurationMs);
}
