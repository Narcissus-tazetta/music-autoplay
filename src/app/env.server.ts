import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const NODE_ENV = (process.env.NODE_ENV ?? 'development') as
    | 'development'
    | 'test'
    | 'production';

const isTest = NODE_ENV === 'test';

const clientUrlDefault = process.env.CLIENT_URL
    ?? (NODE_ENV === 'production'
        ? 'https://music-auto-play.onrender.com'
        : 'http://localhost:3000');

const toNumber = (v: unknown) => {
    if (v == undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};

const serverEnvSchema = z
    .object({
        ADMIN_PASSWORD: isTest
            ? z.string().default('password123')
            : z.string()
                .min(12, 'ADMIN_PASSWORD must be at least 12 characters')
                .regex(/[a-z]/, 'ADMIN_PASSWORD must contain at least one lowercase letter')
                .regex(/[A-Z]/, 'ADMIN_PASSWORD must contain at least one uppercase letter')
                .regex(/[0-9]/, 'ADMIN_PASSWORD must contain at least one digit')
                .regex(/[^A-Za-z0-9]/, 'ADMIN_PASSWORD must contain at least one special character'),
        ADMIN_SECRET: isTest
            ? z.string().default('test-admin-secret-32-characters-long')
            : z.string().min(32, 'ADMIN_SECRET must be >= 32 characters'),
        ADMIN_USER: isTest
            ? z.string().default('admin')
            : z.string().min(1, 'ADMIN_USER is required'),
        // Optional: when PATHFINDER_USER/PATHFINDER_PASSWORD are absent the pathfinder login is disabled,
        // so existing deployments keep booting without new env vars.
        PATHFINDER_PASSWORD: isTest
            ? z.string().default('password123')
            : z.string()
                .min(12, 'PATHFINDER_PASSWORD must be at least 12 characters')
                .regex(/[a-z]/, 'PATHFINDER_PASSWORD must contain at least one lowercase letter')
                .regex(/[A-Z]/, 'PATHFINDER_PASSWORD must contain at least one uppercase letter')
                .regex(/[0-9]/, 'PATHFINDER_PASSWORD must contain at least one digit')
                .regex(/[^A-Za-z0-9]/, 'PATHFINDER_PASSWORD must contain at least one special character')
                .optional(),
        PATHFINDER_USER: isTest
            ? z.string().default('pathfinder')
            : z.string().min(1).optional(),
        ALLOW_EXTENSION_ORIGINS: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional()),
        CLIENT_URL: z.string().url().default(clientUrlDefault),
        CORS_ORIGINS: z.string().optional(),
        DIAG_MEM_ENABLED: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional().default(true)),
        DIAG_MEM_LOG_INTERVAL_MS: z.preprocess(
            v => toNumber(v),
            z.number().int().positive().default(30_000),
        ),
        DIAG_MEM_REQUIRE_ADMIN_SECRET: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional().default(false)),
        MONGODB_URI: z.string().optional(),
        MONGODB_DB_NAME: z.string().optional().default('musicReq'),
        MONGODB_COLLECTION: z.string().optional().default('musicRequests'),
        MONGODB_REQUEST_LOG_COLLECTION: z.string().optional().default('requestLogs'),
        PERSISTENCE_PROVIDER: z
            .enum(['file', 'mongo'])
            .optional()
            .default('file'),
        GOOGLE_CLIENT_ID: isTest
            ? z.string().default('test-google-client-id')
            : z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
        GOOGLE_CLIENT_SECRET: isTest
            ? z.string().default('test-google-client-secret')
            : z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
        ENABLE_HTTP_COMPRESSION: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional()),
        LOG_LEVEL: z
            .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
            .default(NODE_ENV === 'production' ? 'info' : (isTest ? 'error' : 'debug')),
        MORGAN_FORMAT: z.string().default('tiny'),
        MORGAN_LOG_SOCKETIO: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional()),
        NODE_ENV: z
            .enum(['development', 'test', 'production'])
            .default('development'),
        PORT: z.preprocess(
            v => toNumber(v),
            z.number().int().positive().default(3000),
        ),
        PROGRESS_COOLDOWN_MS: z.preprocess(
            v => toNumber(v),
            z.number().int().nonnegative().default(5000),
        ),
        PROGRESS_MIN_DELTA_SEC: z.preprocess(
            v => toNumber(v),
            z.number().nonnegative().default(0.5),
        ),
        PROGRESS_STALL_COUNT: z.preprocess(
            v => toNumber(v),
            z.number().int().positive().default(3),
        ),
        PROGRESS_STALL_THRESHOLD_MS: z.preprocess(
            v => toNumber(v),
            z.number().int().nonnegative().default(3000),
        ),
        RATE_LIMIT_MAX_ATTEMPTS: z.preprocess(
            v => toNumber(v),
            z.number().int().positive().default(10),
            // 10 times per minute
        ),
        RATE_LIMIT_WINDOW_MS: z.preprocess(
            v => toNumber(v),
            z.number().int().positive().default(60_000),
        ),
        REMOTE_STATUS_DEBOUNCE_MS: z.preprocess(
            v => toNumber(v),
            z.number().int().nonnegative().default(250),
        ),
        REMOTE_STATUS_GRACE_MS: z.preprocess(
            v => toNumber(v),
            z.number().int().nonnegative().default(5000),
        ),
        REMOTE_STATUS_INACTIVITY_MS: z.preprocess(
            v => toNumber(v),
            z
                .number()
                .int()
                .nonnegative()
                .default(1000 * 60 * 10),
        ),
        REMOTE_STATUS_INACTIVITY_MS_PLAYING: z.preprocess(
            v => toNumber(v),
            z
                .number()
                .int()
                .nonnegative()
                .default(1000 * 60 * 5),
        ),
        REMOTE_STATUS_INACTIVITY_MS_PAUSED: z.preprocess(
            v => toNumber(v),
            z
                .number()
                .int()
                .nonnegative()
                .default(1000 * 60 * 30),
        ),
        SESSION_SECRET: isTest
            ? z.string().default('test-session-secret-at-least-32-chars')
            : z.string().min(1, 'SESSION_SECRET is required'),
        SHUTDOWN_TIMEOUT_MS: z.preprocess(
            v => toNumber(v),
            z.number().int().nonnegative().default(5000),
        ),
        SOCKET_PATH: z.string().default('/api/socket.io'),
        SOCKET_HTTP_COMPRESSION: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional()),
        SOCKET_PERMESSAGE_DEFLATE: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional()),
        SOCKET_WEBSOCKET_ONLY: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional()),
        SOCKET_EVENT_LOG_ENABLED: z.preprocess(v => {
            if (v == undefined || v === '') return undefined;
            if (typeof v === 'string') return v === 'true' ? true : (v === 'false' ? false : undefined);
            return undefined;
        }, z.boolean().optional()),
        SOCKET_EVENT_LOG_SAMPLE_RATE: z.preprocess(
            v => toNumber(v),
            z.number().min(0).max(1).optional(),
        ),
        WINDOW_CLOSE_DEBOUNCE_MS: z.preprocess(
            v => toNumber(v),
            z.number().int().nonnegative().default(500),
        ),
        YOUTUBE_REQUEST_QUEUE_MAX: z.preprocess(
            v => toNumber(v),
            z.number().int().positive().default(500),
        ),
        YOUTUBE_API_KEY: isTest
            ? z.string().default('test-youtube-api-key')
            : z.string().min(1, 'YOUTUBE_API_KEY is required'),
        YAHOO_FURIGANA_ENDPOINT: z
            .string()
            .url()
            .optional()
            .default('https://classroom-enhancer.ibaragiakira2007.workers.dev'),
    })
    .strict();

export const SERVER_ENV = (() => {
    if (process.env.ADMIN_MAX_ATTEMPTS !== undefined) {
        throw new Error(
            'Environment variable ADMIN_MAX_ATTEMPTS is deprecated. Please use RATE_LIMIT_MAX_ATTEMPTS instead.',
        );
    }
    if (process.env.ADMIN_WINDOW_MS !== undefined) {
        throw new Error(
            'Environment variable ADMIN_WINDOW_MS is deprecated. Please use RATE_LIMIT_WINDOW_MS instead.',
        );
    }

    // Derive the input from the schema itself. Hand-listing the keys previously let
    // REMOTE_STATUS_INACTIVITY_MS_PLAYING fall out of the object, silently pinning it
    // to its default; picking from the shape makes that class of drift impossible.
    const parsed = serverEnvSchema.safeParse(
        Object.fromEntries(
            Object.keys(serverEnvSchema.shape).map(key => [key, process.env[key]]),
        ),
    );

    if (!parsed.success) {
        const allErrors = Object.values(parsed.error.flatten().fieldErrors)
            .flat()
            .filter(Boolean)
            .join('\n');
        throw new Error(`Invalid server environment:\n${allErrors}`);
    }

    return parsed.data;
})();

export type ServerEnv = typeof SERVER_ENV;
