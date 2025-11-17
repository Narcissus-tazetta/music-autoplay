import { withErrorHandler } from "@/shared/utils/errors";
import type { Request } from "express";
import { SERVER_ENV } from "~/env.server";
import logger from "../../logger";
import { getConfig } from "../../utils/configUtils";
import { logCorsViolation } from "../../utils/securityLogger";

export type CorsConfig = {
  origins: string[];
  allowAllOrigins: boolean;
  allowExtensionOrigins: boolean;
};

export function buildCorsConfig(): CorsConfig {
  const config = getConfig();
  const corsRaw = config.getString("CORS_ORIGINS") || SERVER_ENV.CLIENT_URL;
  const safeCorsRaw = corsRaw || "";
  const origins = (safeCorsRaw || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  const isDev = config.nodeEnv !== "production";
  const port = config.getNumber("PORT") || SERVER_ENV.PORT;

  if (isDev) {
    const currentOrigin = `http://localhost:${port}`;
    if (!origins.includes(currentOrigin)) origins.push(currentOrigin);
  }
  const allowAllOrigins =
    isDev && origins.length === 0 && config.nodeEnv !== "production";

  const safeBool = (v: unknown, fallback = false) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v === "true";
    return fallback;
  };
  const allowExtensionOrigins =
    config.nodeEnv === "production"
      ? false
      : safeBool(
          config.getString("ALLOW_EXTENSION_ORIGINS") ||
            SERVER_ENV.ALLOW_EXTENSION_ORIGINS ||
            false,
          false,
        );

  if (
    allowExtensionOrigins &&
    !origins.some((o) => o === "chrome-extension://")
  )
    origins.push("chrome-extension://");

  if (config.nodeEnv !== "production") {
    logger.info("SocketServerInstance CORS config", {
      origins,
      allowAllOrigins,
      allowExtensionOrigins,
      environment: config.nodeEnv,
    });
  }

  return { origins, allowAllOrigins, allowExtensionOrigins };
}

export function makeOriginChecker(
  cfg: CorsConfig,
): (
  origin: unknown,
  callback: (err: Error | null, allow?: boolean) => void,
) => void {
  const originChecker = withErrorHandler(
    (
      origin: unknown,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const decision = { allowed: false, reason: "unknown" };
      if (origin == null) {
        decision.allowed = true;
        decision.reason = "no-origin (server/API)";
        logger.info("socket connection: no origin (server/API)", {
          timestamp: new Date().toISOString(),
        });
        callback(null, true);
        return;
      }

      if (typeof origin !== "string") {
        decision.allowed = false;
        decision.reason = "non-string origin";
        logger.warn("socket connection: non-string origin", {
          origin,
          timestamp: new Date().toISOString(),
        });
        callback(new Error("Invalid origin type"));
        return;
      }

      decision.allowed = true;
      decision.reason = "allowed by config";

      logger.info("socket connection: origin allowed", {
        origin,
        decision,
        timestamp: new Date().toISOString(),
      });

      if (cfg.allowAllOrigins) {
        callback(null, true);
        return;
      }

      if (Array.isArray(cfg.origins)) {
        let isAllowed = cfg.origins.includes(origin);

        if (!isAllowed && cfg.allowExtensionOrigins) {
          isAllowed = cfg.origins.some((allowed) => {
            if (allowed.endsWith("://") && origin.startsWith(allowed))
              return true;
            return false;
          });
        }

        if (isAllowed) {
          callback(null, true);
          return;
        }

        decision.allowed = false;
        decision.reason = "not in allowed list";

        logCorsViolation({} as Request, origin, decision.reason);

        logger.warn("CORS origin rejected", {
          origin,
          allowedOrigins: cfg.origins,
          allowExtensionOrigins: cfg.allowExtensionOrigins,
          decision,
        });
        callback(new Error("CORS origin not allowed"));
      }
    },
    "makeOriginChecker",
  );

  return originChecker;
}
