import winston from "winston";

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
            return `${timestamp} [${level}] ${message}${metaStr}`;
        })
    ),
    transports: [new winston.transports.Console()],
});

function withContext(ctx: Record<string, unknown>) {
    return {
        info: (msg: string, meta?: Record<string, unknown>) => logger.info(msg, { ...ctx, ...meta }),
        warn: (msg: string, meta?: Record<string, unknown>) => logger.warn(msg, { ...ctx, ...meta }),
        error: (msg: string, meta?: Record<string, unknown>) => logger.error(msg, { ...ctx, ...meta }),
    };
}

export default logger;
export { withContext };

// Convenience functions that always merge ctx and meta
export function logInfo(message: string, ctx: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
    logger.info(message, { ...ctx, ...meta });
}

export function logWarn(message: string, ctx: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
    logger.warn(message, { ...ctx, ...meta });
}

export function logError(message: string, ctx: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
    logger.error(message, { ...ctx, ...meta });
}
