import { SERVER_ENV } from "@/app/env.server";

type ConfigKey = keyof typeof SERVER_ENV;

interface CorsConfig {
  origin: string[] | boolean;
}

class ConfigManager {
  private static instance: ConfigManager | undefined;
  private configCache = new Map<string, unknown>();

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) ConfigManager.instance = new ConfigManager();
    return ConfigManager.instance;
  }

  private safeNumber(v: unknown, fallback: number): number {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return fallback;
  }

  private getFromEnv(key: ConfigKey): unknown {
    return SERVER_ENV[key];
  }

  getServerConfig() {
    return {
      port: this.safeNumber(this.getFromEnv("PORT"), 3000),
      sessionSecret: this.getFromEnv("SESSION_SECRET") as string,
      shutdownTimeoutMs: this.safeNumber(
        this.getFromEnv("SHUTDOWN_TIMEOUT_MS"),
        5000,
      ),
    };
  }

  getSocketConfig() {
    return {
      remoteStatusDebounceMs: this.safeNumber(
        this.getFromEnv("REMOTE_STATUS_DEBOUNCE_MS"),
        0,
      ),
      remoteStatusGraceMs: this.safeNumber(
        this.getFromEnv("REMOTE_STATUS_GRACE_MS"),
        0,
      ),
      remoteStatusInactivityMs: this.safeNumber(
        this.getFromEnv("REMOTE_STATUS_INACTIVITY_MS"),
        0,
      ),
      windowCloseDebounce: this.safeNumber(
        this.getFromEnv("WINDOW_CLOSE_DEBOUNCE_MS"),
        500,
      ),
      adminMaxAttempts: this.safeNumber(
        this.getFromEnv("ADMIN_MAX_ATTEMPTS"),
        5,
      ),
      adminWindowMs: this.safeNumber(this.getFromEnv("ADMIN_WINDOW_MS"), 60000),
    };
  }

  getCorsConfig(): CorsConfig {
    const origins = this.getFromEnv("CORS_ORIGINS") as string;
    return {
      origin: origins ? origins.split(",").map((o: string) => o.trim()) : true,
    };
  }

  getAdminConfig() {
    return {
      secret: this.getFromEnv("ADMIN_SECRET") as string,
    };
  }

  getLoggingConfig() {
    const nodeEnv = this.getFromEnv("NODE_ENV") as string;
    return {
      level: this.getFromEnv("LOG_LEVEL") as string,
      isDev: nodeEnv === "development",
    };
  }

  clearCache(): void {
    this.configCache.clear();
  }
}

export default ConfigManager;
