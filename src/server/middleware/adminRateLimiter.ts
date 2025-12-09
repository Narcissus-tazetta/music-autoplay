interface AttemptRecord {
    fails: number;
    lockedUntil?: number;
}

export class AdminRateLimiter {
    private attempts = new Map<string, AttemptRecord>();
    private readonly maxFails: number;
    private readonly lockDurationMs: number;

    constructor(maxFails = 3, lockDurationMs = 60000) {
        this.maxFails = maxFails;
        this.lockDurationMs = lockDurationMs;
    }

    isLocked(username: string): boolean {
        const record = this.attempts.get(username);
        if (!record) return false;

        const now = Date.now();
        if (record.lockedUntil && now < record.lockedUntil) return true;

        if (record.lockedUntil && now >= record.lockedUntil) this.attempts.delete(username);

        return false;
    }

    recordFailure(username: string): void {
        const record = this.attempts.get(username) ?? { fails: 0 };
        record.fails += 1;

        if (record.fails >= this.maxFails) record.lockedUntil = Date.now() + this.lockDurationMs;

        this.attempts.set(username, record);
    }

    recordSuccess(username: string): void {
        this.attempts.delete(username);
    }

    getRetryAfterSeconds(username: string): number | null {
        const record = this.attempts.get(username);
        if (!record || !record.lockedUntil) return null;

        const now = Date.now();
        if (now >= record.lockedUntil) return null;

        return Math.ceil((record.lockedUntil - now) / 1000);
    }

    cleanup(): void {
        const now = Date.now();
        for (const [username, record] of this.attempts.entries())
            if (record.lockedUntil && now >= record.lockedUntil) this.attempts.delete(username);
    }
}

export function createAdminRateLimiter(
    maxFails = 3,
    lockDurationMs = 60000,
): AdminRateLimiter {
    return new AdminRateLimiter(maxFails, lockDurationMs);
}
