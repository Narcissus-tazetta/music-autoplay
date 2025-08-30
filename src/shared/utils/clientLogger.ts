type LogLevel = "debug" | "info" | "warn" | "error";

const isDevelopment = import.meta.env.DEV;

class FrontendLogger {
    private shouldLog(level: LogLevel): boolean {
        if (!isDevelopment) {
            return level === "warn" || level === "error";
        }
        return true;
    }

    private formatMessage(level: LogLevel, message: string, context?: string): string {
        const timestamp = new Date().toISOString().slice(11, 23);
        const prefix = context ? `[${context}]` : "";
        return `${timestamp} ${prefix} ${message}`;
    }

    debug(message: string, data?: unknown, context?: string): void {
        if (this.shouldLog("debug")) {
            const formattedMessage = this.formatMessage("debug", message, context);
            console.debug(formattedMessage, data || "");
        }
    }

    info(message: string, data?: unknown, context?: string): void {
        if (this.shouldLog("info")) {
            const formattedMessage = this.formatMessage("info", message, context);
            console.info(formattedMessage, data || "");
        }
    }

    warn(message: string, data?: unknown, context?: string): void {
        if (this.shouldLog("warn")) {
            const formattedMessage = this.formatMessage("warn", message, context);
            console.warn(formattedMessage, data || "");
        }
    }

    error(message: string, error?: Error | unknown, context?: string): void {
        if (this.shouldLog("error")) {
            const formattedMessage = this.formatMessage("error", message, context);
            console.error(formattedMessage, error || "");
        }
    }
}

export const clientLog = new FrontendLogger();

export const log = {
    info: (message: string, data?: unknown, context?: string) => clientLog.info(message, data, context),
    warn: (message: string, data?: unknown, context?: string) => clientLog.warn(message, data, context),
    error: (message: string, error?: Error | unknown, context?: string) => clientLog.error(message, error, context),
    debug: (message: string, data?: unknown, context?: string) => clientLog.debug(message, data, context),
};
