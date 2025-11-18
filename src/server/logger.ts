import { extractErrorInfo } from "@/shared/utils/errors";
import { hasOwnProperty, isRecord } from "@/shared/utils/typeGuards";
import chalk from "chalk";
import util from "node:util";
import stripAnsi from "strip-ansi";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { getConfigService } from "./config/configService";
import { extractMetaFields, normalizeMetaForPrint } from "./loggerMeta";
export type SerializedError = {
  message: string;
  code?: string;
  details?: unknown;
  stack?: string | undefined;
};

export function serializeError(err: unknown): SerializedError {
  try {
    const info = extractErrorInfo(err);

    let details: unknown = undefined;
    if (err && typeof err === "object" && !Array.isArray(err)) {
      try {
        const obj = err as Record<string, unknown>;
        if (hasOwnProperty(obj, "details")) details = obj.details;
        else {
          const keys = Object.keys(obj).filter(
            (k) => !["message", "stack", "code"].includes(k),
          );
          if (keys.length) {
            const out: Record<string, unknown> = {};
            for (const k of keys) out[k] = obj[k];
            details = out;
          }
        }
      } catch (_e: unknown) {
        void _e;
      }
    }

    return {
      message: info.message,
      code: info.code,
      stack: info.stack,
      details,
    };
  } catch (_e: unknown) {
    void _e;
    try {
      return { message: String(err), details: undefined };
    } catch {
      return {
        message: Object.prototype.toString.call(err),
        details: undefined,
      };
    }
  }
}
export type AppLogMeta = Record<string, unknown>;
export type AppLogFn = (msg: string, meta?: AppLogMeta) => void;
export type AppLogger = {
  info: AppLogFn;
  warn: AppLogFn;
  error: AppLogFn;
  debug: AppLogFn;
};

const configService = getConfigService();
const logConfig = configService.getLoggingConfig();
const isDev = logConfig.isDev;
const isProd = !isDev;
const configuredLogLevel = logConfig.level;

function safeSerialize(obj: unknown): unknown {
  const seen = new WeakSet();

  function replacer(_key: string, value: unknown) {
    if (typeof value === "symbol") return undefined;
    if (typeof value === "function")
      return `[function ${value.name || "anonymous"}]`;
    if (value instanceof Error)
      return { message: value.message, stack: value.stack };
    if (value && typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(obj, replacer)) as unknown;
  } catch (err: unknown) {
    try {
      return util.inspect(obj, { depth: 4, colors: false });
    } catch (_err2: unknown) {
      try {
        console.debug("safeSerialize failed", String(_err2), String(err));
      } catch (_e: unknown) {
        void _e;
      }
      return "[unserializable]";
    }
  }
}
const baseFormat = isProd
  ? winston.format.combine(winston.format.timestamp(), winston.format.json())
  : winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.splat(),
      winston.format.printf((info) => {
        const recRecord: Record<string, unknown> = isRecord(info)
          ? (info as unknown as Record<string, unknown>)
          : { message: String(info) };

        const timestamp =
          typeof recRecord.timestamp === "string"
            ? recRecord.timestamp
            : new Date().toISOString();
        const rawLevel = recRecord.level;
        const level =
          typeof rawLevel === "string"
            ? rawLevel
            : typeof rawLevel === "number"
              ? String(rawLevel)
              : util.inspect(rawLevel, { depth: 1, colors: false });
        const message =
          typeof recRecord.message === "string"
            ? recRecord.message
            : util.inspect(recRecord.message, { depth: 2, colors: false });
        const standard = new Set(["level", "message", "timestamp"]);
        const metaKeys = Object.keys(recRecord).filter((k) => !standard.has(k));

        let metaStr = "";
        if (metaKeys.length !== 0) {
          const metaObjRaw: Record<string, unknown> = Object.fromEntries(
            metaKeys.map((k) => [k, recRecord[k]]),
          );
          const metaObj = safeSerialize(metaObjRaw);

          try {
            const metaForPrint = normalizeMetaForPrint(metaObj);
            const { consumedKey, extractedState, extractedUrl, rest } =
              extractMetaFields(metaObjRaw, metaForPrint);

            const stateColor = (s?: string) => {
              switch (s) {
                case "playing":
                  return chalk.blue.bold(s);
                case "paused":
                  return chalk.hex("#FFA500")(s);
                case "stop":
                case "stopped":
                case "error":
                case "closed":
                case "window_close":
                  return chalk.red.bold(s);
                case "queued":
                  return chalk.yellow(s);
                default:
                  return chalk.gray(String(s));
              }
            };

            if (extractedState !== undefined || extractedUrl !== undefined) {
              const urlStr = extractedUrl
                ? chalk.hex("#8A2BE2")(extractedUrl)
                : "";
              const stateStr = extractedState ? stateColor(extractedState) : "";

              const restStr = Object.keys(rest).length
                ? JSON.stringify(rest)
                : "";

              const label =
                consumedKey === "status"
                  ? "status"
                  : consumedKey === "youtube"
                    ? "youtube"
                    : consumedKey === "args"
                      ? "args0"
                      : "meta";
              metaStr = `${restStr ? restStr + " " : ""}${label}=${urlStr}${
                stateStr ? ` state=${stateStr}` : ""
              }`;
            } else {
              metaStr =
                typeof metaObj === "string" ? metaObj : JSON.stringify(metaObj);
            }
          } catch (e: unknown) {
            try {
              metaStr =
                typeof metaObj === "string" ? metaObj : JSON.stringify(metaObj);
            } catch (_e: unknown) {
              void _e;
              metaStr = String(metaObj);
            }
            try {
              console.debug("logger meta stringify fallback", e);
            } catch (_e: unknown) {
              void _e;
            }
          }
        }

        return `${timestamp} [${level}] ${message}${metaStr ? ` ${metaStr}` : ""}`;
      }),
    );

const transports: winston.transport[] = [new winston.transports.Console()];

if (isProd) {
  const fileRotateTransport = new DailyRotateFile({
    filename: "logs/app-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxFiles: "30d",
    level: configuredLogLevel,
    utc: true,
    format: winston.format.combine(
      winston.format((info) => {
        const rec: Record<string, unknown> = isRecord(info)
          ? (info as Record<string, unknown>)
          : { message: String(info) };
        if (typeof rec.message === "string")
          rec.message = stripAnsi(rec.message);
        for (const k of Object.keys(rec))
          if (typeof rec[k] === "string") rec[k] = stripAnsi(rec[k]);
        return rec as unknown as winston.Logform.TransformableInfo;
      })(),
      winston.format.timestamp(),
      winston.format.json(),
    ),
  });

  transports.push(fileRotateTransport as unknown as winston.transport);
}

const logger: winston.Logger = winston.createLogger({
  level: configuredLogLevel,
  format: baseFormat,
  transports,
  exitOnError: false,
});

function withContext(ctx: AppLogMeta): AppLogger {
  return {
    info: (msg: string, meta: AppLogMeta = {}) =>
      logger.info(msg, normalizeMeta({ ...ctx, ...meta })),
    warn: (msg: string, meta: AppLogMeta = {}) =>
      logger.warn(msg, normalizeMeta({ ...ctx, ...meta })),
    error: (msg: string, meta: AppLogMeta = {}) =>
      logger.error(msg, normalizeMeta({ ...ctx, ...meta })),
    debug: (msg: string, meta: AppLogMeta = {}) =>
      logger.debug(msg, normalizeMeta({ ...ctx, ...meta })),
  };
}

function replaceConsoleWithLogger(): () => void {
  const originalConsole = { ...console };

  const toMessage = (args: unknown[]) => {
    if (args.length === 0) return "";
    const first = args[0];
    if (typeof first === "string" && first.includes("%")) {
      try {
        return util.format(first, ...args.slice(1));
      } catch (e: unknown) {
        safeLog("debug", "logger toMessage format error", { error: e });
      }
    }
    return args
      .map((a) => (typeof a === "string" ? a : util.inspect(a, { depth: 4 })))
      .join(" ");
  };

  console.log = (...args: unknown[]) => {
    logger.info(toMessage(args));
  };
  console.info = (...args: unknown[]) => {
    logger.info(toMessage(args));
  };
  console.warn = (...args: unknown[]) => {
    logger.warn(toMessage(args));
  };
  console.error = (...args: unknown[]) => {
    const last = args[args.length - 1];
    if (last instanceof Error) {
      const msg = toMessage(args.slice(0, -1));
      logger.error(msg || last.message, {
        error: { message: last.message, stack: last.stack },
      });
    } else {
      logger.error(toMessage(args));
    }
  };
  console.debug = (...args: unknown[]) => {
    logger.debug(toMessage(args));
  };

  return () => {
    Object.assign(console, originalConsole);
  };
}

function installProcessHandlers(opts?: { exitOnUncaught?: boolean }) {
  const exitOnUncaught = opts?.exitOnUncaught ?? true;

  process.on("uncaughtException", (err: unknown) => {
    logger.error("uncaughtException", {
      error: err,
    });
    if (exitOnUncaught) setTimeout(() => process.exit(1), 200);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    logger.error("unhandledRejection", {
      reason,
    });
    if (exitOnUncaught) setTimeout(() => process.exit(1), 200);
  });
}

export default logger;
export { installProcessHandlers, replaceConsoleWithLogger, withContext };

export function logInfo(
  message: string,
  ctx: AppLogMeta = {},
  meta: AppLogMeta = {},
) {
  logger.info(message, normalizeMeta({ ...ctx, ...meta }));
}

function normalizeMeta(meta: AppLogMeta): AppLogMeta {
  const out: AppLogMeta = {};
  for (const k of Object.keys(meta)) {
    const v = meta[k];
    if (k === "error" || k === "reason") out[k] = serializeError(v);
    else out[k] = v;
  }
  return out;
}

export function logWarn(
  message: string,
  ctx: AppLogMeta = {},
  meta: AppLogMeta = {},
) {
  logger.warn(message, normalizeMeta({ ...ctx, ...meta }));
}

export function logError(
  message: string,
  ctx: AppLogMeta = {},
  meta: AppLogMeta = {},
) {
  logger.error(message, normalizeMeta({ ...ctx, ...meta }));
}

export function logMetric(
  name: string,
  ctx: AppLogMeta = {},
  fields: AppLogMeta = {},
) {
  logger.info(
    `metric:${name}`,
    normalizeMeta({
      ...ctx,
      ...fields,
      _metric: true,
      metricName: name,
      timestamp: new Date().toISOString(),
    }),
  );
}

export function safeLog(
  level: "warn" | "debug",
  msg: string,
  meta?: AppLogMeta,
) {
  try {
    if (level === "warn") logger.warn(msg, normalizeMeta(meta ?? {}));
    else logger.debug(msg, normalizeMeta(meta ?? {}));
  } catch (e: unknown) {
    try {
      console.debug(msg, meta, e);
    } catch (_e: unknown) {
      void _e;
    }
  }
}
