import type { Request, Response, NextFunction } from "express";
import { log } from "../logger";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 10) {
      log.debug(`Rate limiter cleanup: ${cleanedCount} entries`);
    }
  }

  checkLimit(
    identifier: string,
    options: RateLimitOptions
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const resetTime = now + options.windowMs;

    let entry = this.store.get(identifier);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime,
      };
      this.store.set(identifier, entry);

      return {
        allowed: true,
        remaining: options.maxRequests - 1,
        resetTime,
      };
    }

    if (entry.count >= options.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;

    return {
      allowed: true,
      remaining: options.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

const rateLimiter = new RateLimiter();

export function createRateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || req.connection.remoteAddress || "unknown";

    const result = rateLimiter.checkLimit(identifier, options);

    res.set({
      "X-RateLimit-Limit": options.maxRequests.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": new Date(result.resetTime).toISOString(),
    });

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

      log.warn(`Rate limit exceeded for IP: ${identifier}`);

      res.status(429).json({
        error: options.message || "Too many requests, please try again later.",
        retryAfter,
      });
      return;
    }

    next();
  };
}

export function createSocketRateLimit(options: RateLimitOptions) {
  return (socketId: string, clientIp?: string): boolean => {
    const identifier = clientIp || socketId;
    const result = rateLimiter.checkLimit(identifier, options);

    if (!result.allowed) {
      log.warn(`Socket rate limit exceeded for: ${identifier}`);
      return false;
    }

    return true;
  };
}

process.on("SIGINT", () => rateLimiter.destroy());
process.on("SIGTERM", () => rateLimiter.destroy());
