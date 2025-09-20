import util from "node:util";
import winston from "winston";
import chalk from "chalk";
import DailyRotateFile from "winston-daily-rotate-file";
import stripAnsi from "strip-ansi";

const isProd = process.env.NODE_ENV === "production";

function safeSerialize(obj: unknown): unknown {
    const seen = new WeakSet();

    function replacer(_key: string, value: unknown) {
        if (typeof value === "symbol") return undefined;
        if (typeof value === "function") return `[function ${value.name || "anonymous"}]`;
        if (value instanceof Error) return { message: value.message, stack: value.stack };
        if (value && typeof value === "object") {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
        }
        return value;
    }

    try {
        return JSON.parse(JSON.stringify(obj, replacer)) as unknown;
    } catch {
        try {
            return util.inspect(obj, { depth: 4, colors: false });
        } catch {
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
              const rec = info as Record<string, unknown>;

              const timestamp = typeof rec.timestamp === "string" ? rec.timestamp : new Date().toISOString();
              const rawLevel = rec.level;
              const level =
                  typeof rawLevel === "string"
                      ? rawLevel
                      : typeof rawLevel === "number"
                        ? String(rawLevel)
                        : util.inspect(rawLevel, { depth: 1, colors: false });
              const message =
                  typeof rec.message === "string"
                      ? rec.message
                      : util.inspect(rec.message, { depth: 2, colors: false });
              const standard = new Set(["level", "message", "timestamp"]);
              const metaKeys = Object.keys(rec).filter((k) => !standard.has(k));

              let metaStr = "";
              if (metaKeys.length !== 0) {
                  const metaObjRaw: Record<string, unknown> = Object.fromEntries(metaKeys.map((k) => [k, rec[k]]));
                  const metaObj = safeSerialize(metaObjRaw);

                  try {
                      const metaForPrint =
                          metaObj && typeof metaObj === "object" ? (metaObj as Record<string, unknown>) : {};

                      // Try multiple shapes where state/url may appear: { youtube: {state,url} }, { status: {type,musicId,musicTitle} }, or args: [{state,url}, ...]
                      let extractedState: string | undefined;
                      let extractedUrl: string | undefined;
                      let consumedKey: string | undefined;

                      // 1) explicit youtube key
                      if (
                          Object.prototype.hasOwnProperty.call(metaObjRaw, "youtube") &&
                          metaForPrint.youtube &&
                          typeof metaForPrint.youtube === "object"
                      ) {
                          const y = metaForPrint.youtube as Record<string, unknown> | undefined;
                          extractedUrl = y && typeof y.url === "string" ? y.url : undefined;
                          extractedState = y && typeof y.state === "string" ? y.state : undefined;
                          consumedKey = "youtube";
                      }

                      // 2) status object (remoteStatus) with type/musicId/musicTitle
                      if (
                          !extractedState &&
                          Object.prototype.hasOwnProperty.call(metaObjRaw, "status") &&
                          metaForPrint.status &&
                          typeof metaForPrint.status === "object"
                      ) {
                          const s = metaForPrint.status as Record<string, unknown>;
                          extractedState =
                              typeof s.type === "string" ? s.type : typeof s.state === "string" ? s.state : undefined;
                          if (!extractedUrl)
                              extractedUrl =
                                  typeof s.musicId === "string"
                                      ? s.musicId
                                      : typeof s.musicTitle === "string"
                                        ? s.musicTitle
                                        : undefined;
                          consumedKey = consumedKey || "status";
                      }

                      // 3) args array (socket event) where first element carries state/url
                      if (!extractedState && Object.prototype.hasOwnProperty.call(metaObjRaw, "args")) {
                          const args = metaForPrint.args;
                          if (Array.isArray(args) && args.length > 0 && typeof args[0] === "object") {
                              const a0 = args[0] as Record<string, unknown>;
                              extractedState =
                                  typeof a0.state === "string"
                                      ? a0.state
                                      : typeof a0.type === "string"
                                        ? a0.type
                                        : undefined;
                              extractedUrl = extractedUrl || (typeof a0.url === "string" ? a0.url : undefined);
                              consumedKey = consumedKey || "args";
                          }
                      }

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

                      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime check for dev-only pretty formatting
                      if (!isProd) {
                          if (extractedState !== undefined || extractedUrl !== undefined) {
                              const urlStr = extractedUrl ? chalk.hex("#8A2BE2")(extractedUrl) : "";
                              const stateStr = extractedState ? stateColor(extractedState) : "";

                              const rest: Record<string, unknown> = {};
                              for (const key of Object.keys(metaForPrint))
                                  if (key !== consumedKey) rest[key] = metaForPrint[key];
                              const restStr = Object.keys(rest).length ? JSON.stringify(rest) : "";

                              const label =
                                  consumedKey === "status"
                                      ? "status"
                                      : consumedKey === "youtube"
                                        ? "youtube"
                                        : consumedKey === "args"
                                          ? "args0"
                                          : "meta";
                              metaStr = `${restStr ? restStr + " " : ""}${label}=${urlStr}${stateStr ? ` state=${stateStr}` : ""}`;
                          } else {
                              metaStr = typeof metaObj === "string" ? metaObj : JSON.stringify(metaObj);
                          }
                      } else {
                          metaStr = typeof metaObj === "string" ? metaObj : JSON.stringify(metaObj);
                      }
                  } catch (e) {
                      metaStr = typeof metaObj === "string" ? metaObj : JSON.stringify(metaObj);
                      void e;
                  }
              }

              return `${timestamp} [${level}] ${message}${metaStr ? ` ${metaStr}` : ""}`;
          })
      );

const transports: winston.transport[] = [new winston.transports.Console()];

if (isProd) {
    const fileRotateTransport = new DailyRotateFile({
        filename: "logs/app-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "50m",
        maxFiles: "30d",
        level: process.env.LOG_LEVEL || "info",
        utc: true,
        format: winston.format.combine(
            winston.format((info) => {
                if (typeof info.message === "string") info.message = stripAnsi(info.message);
                for (const k of Object.keys(info)) {
                    if (typeof (info as Record<string, unknown>)[k] === "string") {
                        (info as Record<string, unknown>)[k] = stripAnsi(
                            (info as Record<string, unknown>)[k] as string
                        );
                    }
                }
                return info;
            })(),
            winston.format.timestamp(),
            winston.format.json()
        ),
    });

    transports.push(fileRotateTransport as unknown as winston.transport);
}

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
    format: baseFormat,
    transports,
    exitOnError: false,
});

function withContext(ctx: Record<string, unknown>) {
    return {
        info: (msg: string, meta?: Record<string, unknown>) => logger.info(msg, { ...ctx, ...meta }),
        warn: (msg: string, meta?: Record<string, unknown>) => logger.warn(msg, { ...ctx, ...meta }),
        error: (msg: string, meta?: Record<string, unknown>) => logger.error(msg, { ...ctx, ...meta }),
        debug: (msg: string, meta?: Record<string, unknown>) => logger.debug(msg, { ...ctx, ...meta }),
    };
}

/**
 * グローバルな console.* メソッドをロガーで置き換えてます。
 * 元の console に戻すためのリストア関数を返します。
 */
function replaceConsoleWithLogger(): () => void {
    const originalConsole = { ...console };

    const toMessage = (args: unknown[]) => {
        if (args.length === 0) return "";
        if (typeof args[0] === "string" && args[0].includes("%")) {
            try {
                return util.format(...(args as [string, ...unknown[]]));
            } catch (e) {
                void e;
            }
        }
        return args.map((a) => (typeof a === "string" ? a : util.inspect(a, { depth: 4 }))).join(" ");
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
            error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
        });
        if (exitOnUncaught) {
            setTimeout(() => process.exit(1), 200);
        }
    });

    process.on("unhandledRejection", (reason: unknown) => {
        logger.error("unhandledRejection", {
            reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason),
        });
        if (exitOnUncaught) {
            setTimeout(() => process.exit(1), 200);
        }
    });
}

export default logger;
export { withContext, replaceConsoleWithLogger, installProcessHandlers };

export function logInfo(message: string, ctx: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
    logger.info(message, { ...ctx, ...meta });
}

export function logWarn(message: string, ctx: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
    logger.warn(message, { ...ctx, ...meta });
}

export function logError(message: string, ctx: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
    logger.error(message, { ...ctx, ...meta });
}

export function logMetric(name: string, ctx: Record<string, unknown> = {}, fields: Record<string, unknown> = {}) {
    logger.info(`metric:${name}`, {
        ...ctx,
        ...fields,
        _metric: true,
        metricName: name,
        timestamp: new Date().toISOString(),
    });
}
