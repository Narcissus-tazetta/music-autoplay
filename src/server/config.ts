import { SERVER_ENV } from '@/server/env.server';

/**
 * Derived views over SERVER_ENV.
 *
 * SERVER_ENV is already zod-validated with defaults applied at import time, so there is
 * nothing left to resolve, coerce, or cache at runtime - these are plain values. The old
 * ConfigService/ServiceResolver/getConfig() stack sat between callers and this same object,
 * re-reading it through a string-keyed Map and returning `T | undefined` for keys that the
 * schema guarantees.
 */

export const socketConfig = {
    rateLimitMaxAttempts: SERVER_ENV.RATE_LIMIT_MAX_ATTEMPTS,
    rateLimitWindowMs: SERVER_ENV.RATE_LIMIT_WINDOW_MS,
    remoteStatusDebounceMs: SERVER_ENV.REMOTE_STATUS_DEBOUNCE_MS,
    remoteStatusGraceMs: SERVER_ENV.REMOTE_STATUS_GRACE_MS,
    remoteStatusInactivityMs: SERVER_ENV.REMOTE_STATUS_INACTIVITY_MS,
    remoteStatusInactivityMsPaused: SERVER_ENV.REMOTE_STATUS_INACTIVITY_MS_PAUSED,
    remoteStatusInactivityMsPlaying: SERVER_ENV.REMOTE_STATUS_INACTIVITY_MS_PLAYING,
    windowCloseDebounce: SERVER_ENV.WINDOW_CLOSE_DEBOUNCE_MS,
} as const;

export const loggingConfig = {
    isDev: SERVER_ENV.NODE_ENV === 'development',
    level: SERVER_ENV.LOG_LEVEL,
} as const;

export const isProduction = SERVER_ENV.NODE_ENV === 'production';
export const isTest = SERVER_ENV.NODE_ENV === 'test';
