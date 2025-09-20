import logger from "../logger";
import { SERVER_ENV } from "~/env.server";

export type CorsConfig = {
  origins: string[];
  allowAllOrigins: boolean;
  allowExtensionOrigins: boolean;
};

export function buildCorsConfig(): CorsConfig {
  const corsRaw = SERVER_ENV.CORS_ORIGINS || SERVER_ENV.CLIENT_URL;
  const origins = (corsRaw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const isDev = SERVER_ENV.NODE_ENV !== "production";
  const allowAllOrigins = isDev && origins.length === 0;
  const allowExtensionOrigins =
    String(SERVER_ENV.ALLOW_EXTENSION_ORIGINS || "") === "true";

  if (SERVER_ENV.NODE_ENV !== "production") {
    logger.info("SocketServerInstance CORS config", {
      origins,
      allowAllOrigins,
    });
  }

  return { origins, allowAllOrigins, allowExtensionOrigins };
}

export function makeOriginChecker(cfg: CorsConfig) {
  return (
    origin: unknown,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    try {
      const decision = { allowed: false, reason: "unknown" } as {
        allowed: boolean;
        reason: string;
      };
      if (!origin) {
        decision.allowed = true;
        decision.reason = "no-origin (server/API)";
        logger.info("socket connection: no origin (server/API)", {
          timestamp: new Date().toISOString(),
        });
        callback(null, true);
        return;
      }
      if (
        cfg.allowExtensionOrigins &&
        typeof origin === "string" &&
        origin.startsWith("chrome-extension://")
      ) {
        decision.allowed = true;
        decision.reason = "allowExtensionOrigins";
        logger.info("allowing chrome-extension origin via config", {
          origin,
          timestamp: new Date().toISOString(),
          allowExtensionOrigins: cfg.allowExtensionOrigins,
        });
        callback(null, true);
        return;
      }
      if (typeof origin === "string" && cfg.origins.includes(origin)) {
        decision.allowed = true;
        decision.reason = "configured origin";
        logger.info("allowing configured origin", {
          origin,
          timestamp: new Date().toISOString(),
        });
        callback(null, true);
        return;
      }
      decision.allowed = false;
      decision.reason = "not in allowed list";
      logger.warn("CORS origin rejected", {
        origin,
        allowedOrigins: cfg.origins,
        allowExtensionOrigins: cfg.allowExtensionOrigins,
        timestamp: new Date().toISOString(),
        decision,
      });
      callback(new Error("CORS origin not allowed"));
    } catch (err) {
      logger.error("CORS origin check failed", {
        origin,
        error: err,
        timestamp: new Date().toISOString(),
      });
      callback(new Error("CORS origin check failed"));
    }
  };
}

export default { buildCorsConfig, makeOriginChecker };
