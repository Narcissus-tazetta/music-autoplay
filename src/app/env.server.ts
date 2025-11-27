import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const NODE_ENV = (process.env.NODE_ENV ?? "development") as
  | "development"
  | "test"
  | "production";

const isTest = NODE_ENV === "test";

const clientUrlDefault =
  process.env.CLIENT_URL ??
  (NODE_ENV === "production"
    ? "https://music-autoplay.onrender.com"
    : "http://localhost:3000");

const toNumber = (v: unknown) => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.preprocess(
      (v) => toNumber(v),
      z.number().int().positive().default(3000),
    ),
    LOG_LEVEL: z
      .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
      .default(NODE_ENV === "production" ? "info" : isTest ? "error" : "debug"),
    SHUTDOWN_TIMEOUT_MS: z.preprocess(
      (v) => toNumber(v),
      z.number().int().nonnegative().default(5000),
    ),

    YOUTUBE_API_KEY: isTest
      ? z.string().default("test-youtube-api-key")
      : z.string().min(1, "YOUTUBE_API_KEY is required"),
    SESSION_SECRET: isTest
      ? z.string().default("test-session-secret-at-least-32-chars")
      : z.string().min(1, "SESSION_SECRET is required"),
    ADMIN_SECRET: isTest
      ? z.string().default("test-admin-secret-32-characters-long")
      : z.string().min(32, "ADMIN_SECRET must be >= 32 characters"),

    GOOGLE_CLIENT_ID: isTest
      ? z.string().default("test-google-client-id")
      : z.string().min(1, "GOOGLE_CLIENT_ID is required"),
    GOOGLE_CLIENT_SECRET: isTest
      ? z.string().default("test-google-client-secret")
      : z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

    CLIENT_URL: z.string().url().default(clientUrlDefault),
    CORS_ORIGINS: z.string().optional(),
    ALLOW_EXTENSION_ORIGINS: z.preprocess((v) => {
      if (v == null || v === "") return undefined;
      if (typeof v === "string")
        return v === "true" ? true : v === "false" ? false : undefined;
      return undefined;
    }, z.boolean().optional()),

    REMOTE_STATUS_DEBOUNCE_MS: z.preprocess(
      (v) => toNumber(v),
      z.number().int().nonnegative().default(250),
    ),
    REMOTE_STATUS_GRACE_MS: z.preprocess(
      (v) => toNumber(v),
      z.number().int().nonnegative().default(5000),
    ),
    REMOTE_STATUS_INACTIVITY_MS: z.preprocess(
      (v) => toNumber(v),
      z
        .number()
        .int()
        .nonnegative()
        .default(1000 * 60 * 10),
    ),
    WINDOW_CLOSE_DEBOUNCE_MS: z.preprocess(
      (v) => toNumber(v),
      z.number().int().nonnegative().default(500),
    ),
    RATE_LIMIT_MAX_ATTEMPTS: z.preprocess(
      (v) => toNumber(v),
      z.number().int().positive().default(10),
    ),
    // 60000 ms = 1 minute, ↑10 attempts per minute
    RATE_LIMIT_WINDOW_MS: z.preprocess(
      (v) => toNumber(v),
      z.number().int().positive().default(60000),
    ),
    DATABASE_URL: z.string().optional(),
    SOCKET_PATH: z.string().default("/api/socket.io"),
    MORGAN_FORMAT: z.string().default("tiny"),
    MORGAN_LOG_SOCKETIO: z.preprocess((v) => {
      if (v == null || v === "") return undefined;
      if (typeof v === "string")
        return v === "true" ? true : v === "false" ? false : undefined;
      return undefined;
    }, z.boolean().optional()),
  })
  .strict();

export const SERVER_ENV = (() => {
  if (process.env.ADMIN_MAX_ATTEMPTS !== undefined) {
    throw new Error(
      "Environment variable ADMIN_MAX_ATTEMPTS is deprecated. Please use RATE_LIMIT_MAX_ATTEMPTS instead.",
    );
  }
  if (process.env.ADMIN_WINDOW_MS !== undefined)
    throw new Error(
      "Environment variable ADMIN_WINDOW_MS is deprecated. Please use RATE_LIMIT_WINDOW_MS instead.",
    );

  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    SHUTDOWN_TIMEOUT_MS: process.env.SHUTDOWN_TIMEOUT_MS,

    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ADMIN_SECRET: process.env.ADMIN_SECRET,

    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

    CLIENT_URL: process.env.CLIENT_URL,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    ALLOW_EXTENSION_ORIGINS: process.env.ALLOW_EXTENSION_ORIGINS,

    REMOTE_STATUS_DEBOUNCE_MS: process.env.REMOTE_STATUS_DEBOUNCE_MS,
    REMOTE_STATUS_GRACE_MS: process.env.REMOTE_STATUS_GRACE_MS,
    REMOTE_STATUS_INACTIVITY_MS: process.env.REMOTE_STATUS_INACTIVITY_MS,
    WINDOW_CLOSE_DEBOUNCE_MS: process.env.WINDOW_CLOSE_DEBOUNCE_MS,
    RATE_LIMIT_MAX_ATTEMPTS: process.env.RATE_LIMIT_MAX_ATTEMPTS,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    DATABASE_URL: process.env.DATABASE_URL,
    SOCKET_PATH: process.env.SOCKET_PATH,
    MORGAN_FORMAT: process.env.MORGAN_FORMAT,
    MORGAN_LOG_SOCKETIO: process.env.MORGAN_LOG_SOCKETIO,
  });

  if (!parsed.success) {
    const allErrors = Object.values(parsed.error.flatten().fieldErrors)
      .flat()
      .filter(Boolean)
      .join("\n");
    throw new Error(`Invalid server environment:\n${allErrors}`);
  }

  return parsed.data;
})();

export type ServerEnv = typeof SERVER_ENV;
