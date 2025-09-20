import type { ServerBuild } from "react-router";
import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import logger from "@/server/logger";
import { SERVER_ENV } from "@/app/env.server";
import { randomUUID } from "crypto";

export async function configureApp(
    app: express.Express,
    getIo: () => { emit: (...args: unknown[]) => void } | null,
    viteDevServer: {
        middlewares?: unknown;
        ssrLoadModule?: (s: string) => Promise<unknown>;
    } | null
): Promise<void> {
    app.use(compression());
    app.disable("x-powered-by");

    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        const rid = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : randomUUID();
        // @ts-expect-error - we attach a runtime-only property `requestId` for observability;
        req.requestId = rid;
        try {
            res.setHeader("X-Request-Id", String(rid));
        } catch (err) {
            logger.debug("bootstrap: failed to set X-Request-Id header", {
                error: err,
            });
        }
        next();
    });

    if (viteDevServer && (viteDevServer as { middlewares?: unknown }).middlewares) {
        app.use((viteDevServer as { middlewares: express.RequestHandler }).middlewares);
    } else {
        app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
    }

    app.use(express.static("build/client", { maxAge: "1h" }));

    try {
        const socketPath = SERVER_ENV.SOCKET_PATH || "/api/socket.io";
        if (SERVER_ENV.NODE_ENV !== "production") {
            const prefixes = Array.from(new Set([socketPath, "/socket.io", "/api/socket.io"].filter(Boolean)));
            for (const p of prefixes) {
                app.use(p, (req: express.Request, res: express.Response, next: express.NextFunction) => {
                    try {
                        const incomingOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "null";
                        res.setHeader("Access-Control-Allow-Origin", incomingOrigin);
                        res.setHeader("Access-Control-Allow-Credentials", "true");
                        res.setHeader("Vary", "Origin");
                        try {
                            logger.info("bootstrap: socketPath middleware request", {
                                mountedPath: p,
                                url: req.url,
                                method: req.method,
                                origin: req.headers.origin ?? null,
                                referer: req.headers.referer ?? null,
                                ua: req.headers["user-agent"] ?? null,
                                ts: new Date().toISOString(),
                            });
                        } catch (e) {
                            logger.debug("bootstrap: failed to log socketPath middleware request", { error: e });
                        }
                    } catch (err) {
                        logger.debug("bootstrap: failed to set dev socket CORS headers", {
                            error: err,
                        });
                    }
                    next();
                });
            }
        }
    } catch (err) {
        logger.debug("bootstrap: error while registering dev socket CORS middleware", { error: err });
    }

    // --- 拡張機能やソケットの問題をデバッグするための診断用エンドポイント ---
    app.get("/diagnostics/socket", (req, res) => {
        try {
            const origin = req.headers.origin;
            const socketPath = SERVER_ENV.SOCKET_PATH || "/api/socket.io";
            const allowExtensionOrigins = String(SERVER_ENV.ALLOW_EXTENSION_ORIGINS || "") === "true";
            res.json({
                ok: true,
                origin: origin ?? null,
                socketPath,
                allowExtensionOrigins,
                note: "Use this endpoint from extension or browser to check request origin and server config",
                debug: {
                    "SERVER_ENV.SOCKET_PATH": SERVER_ENV.SOCKET_PATH,
                    "process.env.SOCKET_PATH": process.env.SOCKET_PATH,
                    "computed socketPath": socketPath,
                },
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e) });
        }
    });
    app.get("/api/musics", (req, res) => {
        try {
            const ioObj = getIo();
            if (ioObj && typeof (ioObj as Record<string, unknown>).musicDB !== "undefined") {
                const musicDB = (ioObj as Record<string, unknown>).musicDB;
                if (musicDB && musicDB instanceof Map) {
                    try {
                        const list = Array.from(musicDB.values());
                        res.json({ ok: true, musics: list });
                        return;
                    } catch (e) {
                        logger.debug("/api/musics: failed to serialize musicDB", {
                            error: e,
                        });
                    }
                }
            }
            res.json({ ok: true, musics: [] });
        } catch (e) {
            res.status(500).json({ ok: false, error: String(e) });
        }
    });

    // morgan -> winston
    {
        const morganFormat = SERVER_ENV.MORGAN_FORMAT || "tiny";
        const skipSocketIo = SERVER_ENV.MORGAN_LOG_SOCKETIO === true ? false : true;
        app.use(
            morgan(morganFormat, {
                skip: (req: express.Request) => {
                    if (!skipSocketIo) return false;
                    try {
                        const path = req.path ? String(req.path) : String(req.url || "");
                        const socketPrefix = SERVER_ENV.SOCKET_PATH || "/api/socket.io";
                        return path.startsWith("/socket.io") || path.startsWith(socketPrefix);
                    } catch (err) {
                        // 念のため: 予期しないことが起きた場合でも、ログ出力をスキップしない
                        logger.debug("morgan: error while deciding skip", { error: err });
                        return false;
                    }
                },
                stream: {
                    write: (msg: string) => {
                        try {
                            logger.info(msg.trim());
                        } catch {
                            console.log(msg.trim());
                        }
                    },
                },
            })
        );
    }
    let buildValue: ServerBuild | (() => Promise<ServerBuild>);
    if (viteDevServer && typeof (viteDevServer as { ssrLoadModule?: unknown }).ssrLoadModule === "function") {
        const loader = (viteDevServer as { ssrLoadModule: (s: string) => Promise<unknown> }).ssrLoadModule;
        buildValue = () => loader("virtual:react-router/server-build") as Promise<ServerBuild>;
    } else {
        // @ts-expect-error ../../build/server/index.jsの型不足エラーを回避
        const built = (await import("../../build/server/index.js")) as ServerBuild;
        buildValue = built;
    }

    app.all(
        "*splat",
        createRequestHandler({
            build: buildValue,
            getLoadContext: () => {
                const io = getIo();
                if (!io) {
                    // ignore-unused: this no-op emits placeholder is intentionally unused
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    return { io: { emit: (..._args: unknown[]) => {} } };
                }
                return { io };
            },
        })
    );
}

export default configureApp;
