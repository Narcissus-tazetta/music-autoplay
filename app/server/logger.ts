import winston from "winston";
import type { LogData } from "./types";

/**
 * Winstonロガー設定
 * 構造化ログとレベル分けを提供
 */
const isDevelopment = process.env.NODE_ENV !== "production";

// カスタムフォーマット（開発環境用）
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, component, data, extra, error, ...meta }) => {
    // componentを先頭に配置
    const componentPrefix = component ? `[${component}] ` : '';
    
    // 基本的なログライン
    let logLine = `${componentPrefix}${timestamp} [${level.toUpperCase()}] ${message}`;
    
    // データがある場合、見やすい形で表示
    if (data && typeof data === 'object') {
      logLine += ` | ${JSON.stringify(data, null, 0)}`;
    } else if (data) {
      logLine += ` | ${data}`;
    }
    
    // extraがある場合（console.logの残り引数）
    if (extra && Array.isArray(extra) && extra.length > 0) {
      logLine += ` | ${extra.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 0) : String(arg)
      ).join(' ')}`;
    }
    
    // エラーがある場合
    if (error) {
      if (error instanceof Error) {
        logLine += ` | Error: ${error.message}`;
        if (error.stack && level === 'error') {
          logLine += `\n${error.stack}`;
        }
      } else {
        logLine += ` | ${JSON.stringify(error, null, 0)}`;
      }
    }
    
    return logLine;
  })
);

// 本番用フォーマット（JSON構造化ログ）
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Winstonロガー作成
export const logger = winston.createLogger({
  level: isDevelopment ? "debug" : "info",
  format: isDevelopment ? customFormat : productionFormat,
  defaultMeta: { service: "music-auto-play" },
  transports: [
    // コンソール出力（シンプル版）
    new winston.transports.Console({
      format: isDevelopment ? customFormat : productionFormat
    }),
    
    // 本番環境ではファイル出力も追加
    ...(isDevelopment ? [] : [
      new winston.transports.File({ 
        filename: "logs/error.log", 
        level: "error" 
      }),
      new winston.transports.File({ 
        filename: "logs/combined.log" 
      })
    ])
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
  // 一般的な情報ログ
  info: (message: string, data?: LogData, ...args: unknown[]) => {
    const logData: LogData = {};
    if (data !== undefined) logData.data = data;
    if (args.length > 0) logData.extra = args;
    logger.info(message, logData);
  },
  
  // 警告ログ
  warn: (message: string, data?: LogData, ...args: unknown[]) => {
    const logData: LogData = {};
    if (data !== undefined) logData.data = data;
    if (args.length > 0) logData.extra = args;
    logger.warn(message, logData);
  },
  
  // エラーログ
  error: (message: string, error?: Error | LogData, ...args: unknown[]) => {
    const logData: LogData = {};
    if (error !== undefined) logData.error = error;
    if (args.length > 0) logData.extra = args;
    logger.error(message, logData);
  },
  
  // デバッグログ（開発時のみ）
  debug: (message: string, data?: LogData, ...args: unknown[]) => {
    const logData: LogData = {};
    if (data !== undefined) logData.data = data;
    if (args.length > 0) logData.extra = args;
    logger.debug(message, logData);
  },
  
  // サーバー状態ログ
  server: (message: string, data?: LogData) => {
    const logData: LogData = { component: "server" };
    if (data !== undefined) logData.data = data;
    logger.info(`🖥️  ${message}`, logData);
  },
  
  // YouTube API関連ログ
  youtube: (message: string, data?: LogData) => {
    const logData: LogData = { component: "youtube" };
    if (data !== undefined) logData.data = data;
    logger.info(`📺 ${message}`, logData);
  },
  
  // Socket.IO関連ログ
  socket: (message: string, data?: LogData) => {
    const logData: LogData = { component: "socket" };
    if (data !== undefined) logData.data = data;
    logger.info(`🔌 ${message}`, logData);
  },
  
  // API使用量ログ
  apiUsage: (message: string, data?: LogData) => {
    const logData: LogData = { component: "api-usage" };
    if (data !== undefined) logData.data = data;
    logger.info(`📊 ${message}`, logData);
  },
};

export default logger;
