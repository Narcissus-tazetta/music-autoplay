/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
import winston from 'winston';
import type { LogData } from './types';

/**
 * Winstonロガー設定
 * 構造化ログとレベル分けを提供
 */
const isDevelopment = process.env.NODE_ENV !== 'production';

const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
        ({ timestamp, level, message, component, data, extra, error }) => {
            const componentPrefix = component ? `[${component}] ` : '';

            let logLine = `${componentPrefix}${timestamp} [${level.toUpperCase()}] ${message}`;

            if (data && typeof data === 'object') logLine += ` | ${JSON.stringify(data, null, 0)}`;
            else if (data) logLine += ` | ${data}`;

            if (extra && Array.isArray(extra) && extra.length > 0) {
                logLine += ` | ${
                    extra
                        .map(arg => (typeof arg === 'object' ? JSON.stringify(arg, null, 0) : String(arg)))
                        .join(' ')
                }`;
            }

            if (error) {
                if (error instanceof Error) {
                    logLine += ` | Error: ${error.message}`;
                    if (error.stack && level === 'error') logLine += `\n${error.stack}`;
                } else {
                    logLine += ` | ${JSON.stringify(error, null, 0)}`;
                }
            }

            return logLine;
        },
    ),
);

const productionFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

export const logger = winston.createLogger({
    level: isDevelopment ? 'debug' : 'info',
    format: isDevelopment ? customFormat : productionFormat,
    defaultMeta: { service: 'music-auto-play' },
    transports: [
        new winston.transports.Console({
            format: isDevelopment ? customFormat : productionFormat,
        }),

        ...(isDevelopment
            ? []
            : [
                new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                }),
                new winston.transports.File({
                    filename: 'logs/combined.log',
                }),
            ]),
    ],
});

/**
 * コンテキスト付きロガー作成
 */
export function createContextLogger(context: string) {
    return logger.child({ context });
}

/**
 * 従来のconsole.logを段階的に置き換えるためのヘルパー
 */
export const log = {
    info: (message: string, data?: LogData, ...args: unknown[]) => {
        const logData: LogData = {};
        if (data !== undefined) logData.data = data;
        if (args.length > 0) logData.extra = args;
        logger.info(message, logData);
    },

    warn: (message: string, data?: LogData, ...args: unknown[]) => {
        const logData: LogData = {};
        if (data !== undefined) logData.data = data;
        if (args.length > 0) logData.extra = args;
        logger.warn(message, logData);
    },

    error: (message: string, error?: Error | LogData, ...args: unknown[]) => {
        const logData: LogData = {};
        if (error !== undefined) logData.error = error;
        if (args.length > 0) logData.extra = args;
        logger.error(message, logData);
    },

    debug: (message: string, data?: LogData, ...args: unknown[]) => {
        const logData: LogData = {};
        if (data !== undefined) logData.data = data;
        if (args.length > 0) logData.extra = args;
        logger.debug(message, logData);
    },

    server: (message: string, data?: LogData) => {
        const logData: LogData = { component: 'server' };
        if (data !== undefined) logData.data = data;
        logger.info(`🖥️  ${message}`, logData);
    },

    youtube: (message: string, data?: LogData) => {
        const logData: LogData = { component: 'youtube' };
        if (data !== undefined) logData.data = data;
        logger.info(`📺 ${message}`, logData);
    },

    socket: (message: string, data?: LogData) => {
        const logData: LogData = { component: 'socket' };
        if (data !== undefined) logData.data = data;
        logger.info(`🔌 ${message}`, logData);
    },

    apiUsage: (message: string, data?: LogData) => {
        const logData: LogData = { component: 'api-usage' };
        if (data !== undefined) logData.data = data;
        logger.info(`📊 ${message}`, logData);
    },
};

export default logger;
