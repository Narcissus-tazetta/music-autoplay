import logger from "@/server/logger";
import { isObject } from "@/shared/utils/typeGuards";
import type { Server as HttpServer } from "http";
import { SERVER_ENV } from "~/env.server";
import { getConfig } from "../../utils/configUtils";
import type { EngineLike, RequestLike } from "../types";

export function getOriginFromReq(req: unknown): string | undefined {
  try {
    if (!isObject(req)) return undefined;
    const headers = (req as RequestLike).headers;
    if (isObject(headers) && typeof headers.origin === "string")
      return headers.origin;
    if (isObject(req) && typeof (req as RequestLike).url === "string")
      return undefined;
    return undefined;
  } catch (err: unknown) {
    logger.debug("getOriginFromReq failed", { error: err });
    return undefined;
  }
}

export function attachUpgradeRewrite(
  server: HttpServer,
  socketPath: string,
  candidatePrefixes: string[],
): void {
  try {
    const maybeEmitter: unknown = server as unknown;
    const onFn =
      maybeEmitter && typeof maybeEmitter === "object"
        ? (maybeEmitter as Record<string, unknown>)["on"]
        : undefined;
    if (typeof onFn === "function") {
      (onFn as (...a: unknown[]) => void).call(
        server,
        "upgrade",
        (req: unknown) => {
          try {
            if (!req || typeof req !== "object") return;
            const reqObj = req as { url?: unknown };
            const reqUrl = typeof reqObj.url === "string" ? reqObj.url : "";
            if (!reqUrl) return;
            for (const p of candidatePrefixes) {
              if (p && reqUrl.startsWith(p) && p !== socketPath) {
                try {
                  (reqObj as { url: string }).url = reqUrl.replace(
                    p,
                    socketPath,
                  );
                  logger.info(
                    "upgrade: rewrote socket upgrade url for legacy path",
                    {
                      original: reqUrl,
                      rewritten: (reqObj as { url: string }).url,
                    },
                  );
                } catch (err: unknown) {
                  logger.debug("upgrade: failed to rewrite url", {
                    error: err,
                    original: reqUrl,
                  });
                }
                break;
              }
            }
          } catch (err: unknown) {
            logger.debug("upgrade handler failed", { error: err });
          }
        },
      );
    }
  } catch (e: unknown) {
    logger.debug("failed to register upgrade rewrite handler", { error: e });
  }
}

export function registerEngineAugmentations(
  engine: unknown,
  socketPath: string,
): void {
  const config = getConfig();

  const safeBool = (v: unknown, fallback = false) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v === "true";
    return fallback;
  };

  try {
    if (!isObject(engine)) return;

    const engineOn = engine["on"];
    if (typeof engineOn === "function") {
      const engineOnCall = engineOn as (...a: unknown[]) => void;
      engineOnCall.call(
        engine,
        "initial_headers",
        (headers: Record<string, string>, req: unknown) => {
          try {
            const incomingOrigin = getOriginFromReq(req);
            const corsRaw = config.getString("CORS_ORIGINS") || "";
            const clientUrl = config.getString("CLIENT_URL");
            const allowAllOrigins =
              config.nodeEnv !== "production" && !(corsRaw || clientUrl);
            const allowExtensionOrigins = safeBool(
              config.getString("ALLOW_EXTENSION_ORIGINS") ||
                SERVER_ENV.ALLOW_EXTENSION_ORIGINS,
              false,
            );
            let setOrigin: string | undefined;
            if (
              typeof incomingOrigin === "string" &&
              incomingOrigin.length > 0
            ) {
              if (allowAllOrigins) setOrigin = incomingOrigin;
              else if (
                allowExtensionOrigins &&
                incomingOrigin.startsWith("chrome-extension://")
              ) {
                setOrigin = incomingOrigin;
              } else {
                const origins = (corsRaw || "")
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean);
                if (origins.includes(incomingOrigin))
                  setOrigin = incomingOrigin;
              }
            } else if (config.nodeEnv !== "production") {
              setOrigin = "null";
            }

            if (setOrigin) {
              headers["Access-Control-Allow-Origin"] = setOrigin;
              headers["Access-Control-Allow-Credentials"] = "true";
              headers["Vary"] = "Origin";
            } else if (
              typeof incomingOrigin === "undefined" &&
              config.nodeEnv === "production"
            ) {
              const reqUrlForLog =
                isObject(req) &&
                typeof (req as { url?: unknown }).url === "string"
                  ? (req as { url?: unknown }).url
                  : undefined;
              logger.warn(
                "socket polling handshake missing Origin in production; not adding ACAO",
                {
                  url: reqUrlForLog,
                },
              );
            }
          } catch (err: unknown) {
            logger.debug("initial_headers handler failed", { error: err });
          }
        },
      );
    }
  } catch (err: unknown) {
    logger.debug("engine.on('initial_headers') registration failed", {
      error: err,
    });
  }

  try {
    const httpServer = (engine as EngineLike)["httpServer"];
    if (isObject(httpServer)) {
      const maybeHttpOn = httpServer["on"];
      if (typeof maybeHttpOn === "function") {
        const httpOnFn = maybeHttpOn as (
          ev: string,
          handler: (req: unknown, res: unknown) => void,
        ) => void;
        const reqHandler = (req: unknown, res: unknown) => {
          try {
            if (!req || typeof req !== "object") return;
            const reqObj = req as {
              url?: unknown;
              headers?: Record<string, unknown>;
              method?: unknown;
            };
            if (!reqObj.url || typeof reqObj.url !== "string") return;
            const candidatePrefixes = [
              socketPath,
              "/socket.io",
              "/api/socket.io",
            ].filter(Boolean);
            const reqUrl =
              typeof reqObj.url === "string" ? reqObj.url : undefined;
            if (!reqUrl) return;
            const matchesPrefix = candidatePrefixes.some((p) =>
              reqUrl.startsWith(p),
            );
            if (!matchesPrefix) return;
            let incomingOrigin: string | undefined;
            if (
              isObject(reqObj.headers) &&
              typeof reqObj.headers.origin === "string"
            ) {
              incomingOrigin = reqObj.headers.origin;
            }
            if (
              typeof incomingOrigin !== "string" ||
              incomingOrigin.trim().length === 0
            ) {
              if (config.nodeEnv !== "production") {
                try {
                  const setHeader = (res as Record<string, unknown>)[
                    "setHeader"
                  ];
                  if (typeof setHeader === "function") {
                    const setHeaderFn = setHeader as (
                      k: string,
                      v: string,
                    ) => void;
                    setHeaderFn.call(
                      res,
                      "Access-Control-Allow-Origin",
                      "null",
                    );
                    setHeaderFn.call(
                      res,
                      "Access-Control-Allow-Credentials",
                      "true",
                    );
                    setHeaderFn.call(res, "Vary", "Origin");
                  }
                } catch (_e: unknown) {
                  void _e;
                }
                logger.info(
                  "engine http request: patched ACAO for no-origin request",
                  {
                    url: reqUrl,
                    method: reqObj.method,
                    ts: new Date().toISOString(),
                  },
                );
              }
            }
            if (config.nodeEnv !== "production") {
              try {
                const rh = reqObj.headers;
                logger.info("engine http request for socket path", {
                  url: reqObj.url,
                  method: reqObj.method,
                  origin:
                    isObject(rh) && typeof rh.origin === "string"
                      ? rh.origin
                      : null,
                  referer:
                    isObject(rh) && typeof rh.referer === "string"
                      ? rh.referer
                      : null,
                  cookie:
                    isObject(rh) && typeof rh.cookie === "string"
                      ? "[REDACTED]"
                      : undefined,
                  ua:
                    isObject(rh) && rh["user-agent"] ? rh["user-agent"] : null,
                  ts: new Date().toISOString(),
                });
              } catch (err: unknown) {
                try {
                  logger.debug("failed to log engine http request", {
                    error: err,
                  });
                } catch (_e: unknown) {
                  void _e;
                }
              }
            }
          } catch (err: unknown) {
            logger.debug("engine httpServer request augmentation failed", {
              error: err,
            });
          }
        };
        httpOnFn.call(httpServer, "request", reqHandler);
      }
    }
  } catch (err: unknown) {
    logger.debug("failed to register httpServer request augmentation", {
      error: err,
    });
  }

  try {
    const engineOn2 = (engine as EngineLike)["on"];
    if (typeof engineOn2 === "function") {
      const engineOn2Fn = engineOn2 as (...a: unknown[]) => void;
      engineOn2Fn.call(engine, "connection", (conn: unknown) => {
        try {
          const req = isObject(conn) ? conn["request"] : undefined;
          if (isObject(req)) {
            const url = req["url"];
            const headers = req["headers"];
            logger.info("engine connection established", {
              url: typeof url === "string" ? url : undefined,
              origin:
                isObject(headers) && typeof headers["origin"] === "string"
                  ? headers["origin"]
                  : null,
              referer:
                isObject(headers) && typeof headers["referer"] === "string"
                  ? headers["referer"]
                  : null,
              ua:
                isObject(headers) && headers["user-agent"]
                  ? headers["user-agent"]
                  : null,
              ts: new Date().toISOString(),
            });
          }

          if (isObject(conn)) {
            const maybeOn = conn["on"];
            if (typeof maybeOn === "function") {
              const connOnFn = maybeOn as (
                ev: string,
                handler: (...a: unknown[]) => void,
              ) => void;
              connOnFn.call(conn, "error", (err: unknown) => {
                try {
                  const req2 = conn["request"];
                  const url = isObject(req2) ? req2["url"] : undefined;
                  const headers = isObject(req2) ? req2["headers"] : undefined;
                  logger.warn("engine connection error", {
                    error: err,
                    url: typeof url === "string" ? url : undefined,
                    origin:
                      isObject(headers) && typeof headers["origin"] === "string"
                        ? headers["origin"]
                        : null,
                    ts: new Date().toISOString(),
                  });
                } catch (innerErr: unknown) {
                  try {
                    logger.debug("failed to log engine conn error", {
                      error: innerErr,
                    });
                  } catch (_e: unknown) {
                    void _e;
                  }
                }
              });

              const connOnCloseFn = maybeOn as (
                ev: string,
                handler: (reason: unknown) => void,
              ) => void;
              connOnCloseFn.call(conn, "close", (reason: unknown) => {
                try {
                  const req2 = conn["request"];
                  const url = isObject(req2) ? req2["url"] : undefined;
                  const headers = isObject(req2) ? req2["headers"] : undefined;
                  logger.info("engine connection closed", {
                    reason,
                    url: typeof url === "string" ? url : undefined,
                    origin:
                      isObject(headers) && typeof headers["origin"] === "string"
                        ? headers["origin"]
                        : null,
                    ts: new Date().toISOString(),
                  });
                } catch (innerErr: unknown) {
                  try {
                    logger.debug("failed to log engine conn close", {
                      error: innerErr,
                    });
                  } catch (_e: unknown) {
                    void _e;
                  }
                }
              });
            }
          }
        } catch (innerErr: unknown) {
          logger.debug("engine connection handler failed", { error: innerErr });
        }
      });
    }
  } catch (e: unknown) {
    logger.debug("failed to register engine connection logging", { error: e });
  }
}
