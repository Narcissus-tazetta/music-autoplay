export class RateLimiter {
    private attempts: Map<string, number[]> = new Map();

    constructor(
        private maxAttempts: number,
        private windowMs: number,
    ) {}

    check(key: string): boolean {
        const now = Date.now();
        const arr = this.attempts.get(key) ?? [];
        const recent = arr.filter(t => now - t < this.windowMs);
        if (recent.length !== arr.length) this.attempts.set(key, recent);
        return recent.length < this.maxAttempts;
    }

    consume(key: string): void {
        const now = Date.now();
        const arr = this.attempts.get(key) ?? [];
        const recent = arr.filter(t => now - t < this.windowMs);
        recent.push(now);
        this.attempts.set(key, recent);
    }

    tryConsume(key: string): boolean {
        if (!this.check(key)) return false;
        this.consume(key);
        return true;
    }

    getOldestAttempt(key: string): number | undefined {
        const arr = this.attempts.get(key);
        if (!arr || arr.length === 0) return undefined;
        return Math.min(...arr);
    }

    getRetryAfterSeconds(key: string): number {
        const now = Date.now();
        const recent = (this.attempts.get(key) ?? []).filter(t => now - t < this.windowMs);
        if (recent.length === 0) return 0;
        return Math.max(1, Math.ceil((Math.min(...recent) + this.windowMs - now) / 1000));
    }

    getStats(): { totalKeys: number; totalAttempts: number } {
        let totalAttempts = 0;
        for (const arr of this.attempts.values()) totalAttempts += arr.length;
        return {
            totalAttempts,
            totalKeys: this.attempts.size,
        };
    }

    clear(key: string): void {
        this.attempts.delete(key);
    }

    clearAll(): void {
        this.attempts.clear();
    }
}
