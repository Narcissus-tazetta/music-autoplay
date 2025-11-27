import { SERVER_ENV } from "@/app/env.server";

type ConfigKey = keyof typeof SERVER_ENV;

export interface ServerConfig {
  port: number;
  sessionSecret: string;
  shutdownTimeoutMs: number;
}

export interface SocketConfig {
  remoteStatusDebounceMs: number;
  remoteStatusGraceMs: number;
  remoteStatusInactivityMs: number;
  windowCloseDebounce: number;
  rateLimitMaxAttempts: number;
  rateLimitWindowMs: number;
}

export interface CorsConfig {
  origin: string[] | boolean;
}

export interface AdminConfig {
  secret: string;
}

export interface LoggingConfig {
  level: string;
  isDev: boolean;
}

export class ConfigService {
  private static instance: ConfigService | undefined;
  private cache = new Map<string, unknown>();

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) ConfigService.instance = new ConfigService();
    return ConfigService.instance;
  }

  getString(key: ConfigKey, fallback?: string): string | undefined {
    const cacheKey = `str:${key}`;
    if (this.cache.has(cacheKey))
      return this.cache.get(cacheKey) as string | undefined;

    const value = SERVER_ENV[key];
    const result =
      typeof value === "string" && value.length > 0 ? value : fallback;
    this.cache.set(cacheKey, result);
    return result;
  }

  getNumber(key: ConfigKey, fallback?: number): number | undefined {
    const cacheKey = `num:${key}`;
    if (this.cache.has(cacheKey))
      return this.cache.get(cacheKey) as number | undefined;

    const value = SERVER_ENV[key];
    let result: number | undefined;

    if (typeof value === "number") result = value;
    else if (typeof value === "string" && value.length > 0) {
      const parsed = Number(value);
      result = !Number.isNaN(parsed) ? parsed : fallback;
    } else {
      result = fallback;
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  getBoolean(key: ConfigKey, fallback: boolean = false): boolean {
    const cacheKey = `bool:${key}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey) as boolean;

    const value = SERVER_ENV[key];
    let result: boolean;

    if (typeof value === "boolean") result = value;
    else if (typeof value === "string") {
      const lower = value.toLowerCase();
      result = lower === "true" || lower === "1" || lower === "yes";
    } else {
      result = fallback;
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  requireString(key: ConfigKey): string {
    const value = this.getString(key);
    if (!value) throw new Error(`Missing required config: ${key}`);
    return value;
  }

  requireNumber(key: ConfigKey): number {
    const value = this.getNumber(key);
    if (typeof value !== "number")
      throw new Error(`Missing or invalid numeric config: ${key}`);
    return value;
  }

  getServerConfig(): ServerConfig {
    return {
      port: this.getNumber("PORT", 3000) ?? 3000,
      sessionSecret: this.requireString("SESSION_SECRET"),
      shutdownTimeoutMs: this.getNumber("SHUTDOWN_TIMEOUT_MS", 5000) ?? 5000,
    };
  }

  getSocketConfig(): SocketConfig {
    return {
      remoteStatusDebounceMs:
        this.getNumber("REMOTE_STATUS_DEBOUNCE_MS", 0) ?? 0,
      remoteStatusGraceMs: this.getNumber("REMOTE_STATUS_GRACE_MS", 0) ?? 0,
      remoteStatusInactivityMs:
        this.getNumber("REMOTE_STATUS_INACTIVITY_MS", 0) ?? 0,
      windowCloseDebounce:
        this.getNumber("WINDOW_CLOSE_DEBOUNCE_MS", 500) ?? 500,
      rateLimitMaxAttempts: this.getNumber("RATE_LIMIT_MAX_ATTEMPTS", 10) ?? 10,
      rateLimitWindowMs: this.getNumber("RATE_LIMIT_WINDOW_MS", 60000) ?? 60000,
    };
  }

  getCorsConfig(): CorsConfig {
    const origins = this.getString("CORS_ORIGINS");
    return {
      origin: origins ? origins.split(",").map((o) => o.trim()) : true,
    };
  }

  getAdminConfig(): AdminConfig {
    return {
      secret: this.requireString("ADMIN_SECRET"),
    };
  }

  getLoggingConfig(): LoggingConfig {
    const nodeEnv = this.getString("NODE_ENV", "development") ?? "development";
    return {
      level: this.getString("LOG_LEVEL", "info") ?? "info",
      isDev: nodeEnv === "development",
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export function getConfigService(): ConfigService {
  return ConfigService.getInstance();
}

export default ConfigService;
