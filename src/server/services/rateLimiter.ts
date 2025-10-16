export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number,
    private windowMs: number,
  ) {}

  tryConsume(key: string): boolean {
    const now = Date.now();
    const arr = this.attempts.get(key) ?? [];
    const recent = arr.filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.attempts.set(key, recent);
    return recent.length <= this.maxAttempts;
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }

  clearAll(): void {
    this.attempts.clear();
  }
}
