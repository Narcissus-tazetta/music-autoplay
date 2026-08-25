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

    /**
     * Drops keys whose attempts have all aged out. Without it the map only ever shrinks for
     * keys that come back, so a caller cycling through keys grows it without bound.
     */
    sweep(): number {
        const now = Date.now();
        let removed = 0;
        for (const [key, timestamps] of this.attempts) {
            const recent = timestamps.filter(t => now - t < this.windowMs);
            if (recent.length === 0) {
                this.attempts.delete(key);
                removed++;
            } else if (recent.length !== timestamps.length) { this.attempts.set(key, recent); }
        }
        return removed;
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
