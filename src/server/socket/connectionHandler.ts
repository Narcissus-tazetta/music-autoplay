import { randomUUID } from "crypto";
import type { Socket } from "socket.io";
import type { Server as IOServer } from "socket.io";
import type { Music } from "~/stores/musicStore";
import logger, { logMetric, withContext } from "../logger";
import type MusicService from "../music/musicService";
import type { Store } from "../persistence";
import { withErrorHandler } from "../utils/errorHandler";
import ServiceResolver from "../utils/serviceResolver";
import { createSocketEmitter } from "../utils/socketEmitter";
import type { TimerManager } from "../utils/socketHelpers";
import type WindowCloseManager from "../utils/windowCloseManager";
import type { YouTubeService } from "../youtubeService";
import { registerSocketHandlers } from "./handlers";
import type SocketManager from "./manager";
import { sanitizeArgs, snapshotHeaders } from "./utils";

export type ConnectionDeps = {
  getIo: () => IOServer;
  getMusicService: () => MusicService;
  getManager: () => SocketManager | undefined;
  createManager: () => SocketManager;
  musicDB: Map<string, Music>;
  youtubeService: YouTubeService;
  fileStore: Store;
  adminHash: string;
  timerManager: TimerManager;
  windowCloseManager: InstanceType<typeof WindowCloseManager>;
};

export type ConnectionHandlerFactory = (
  deps: ConnectionDeps,
) => (socket: Socket) => void;

export function makeConnectionHandler(deps: ConnectionDeps) {
  return (socket: Socket) => {
    const connectionId = randomUUID();
    let requestId: string | undefined;
    try {
      const hdrs = snapshotHeaders(socket);
      const maybeId = hdrs?.["x-request-id"];
      if (typeof maybeId === "string") requestId = maybeId;
    } catch (err: unknown) {
      logger.debug("failed to extract request id from handshake headers", {
        error: err,
        socketId: socket.id,
      });
      requestId = undefined;
    }

    const log = withContext({ socketId: socket.id, connectionId, requestId });
    const manager = deps.getManager() ?? deps.createManager();

    const headersSnapshot = snapshotHeaders(socket);
    const origin =
      typeof headersSnapshot?.origin === "string"
        ? headersSnapshot.origin
        : undefined;
    const isExtension = origin?.startsWith("chrome-extension://") ?? false;

    function getConn(s: Socket) {
      const rec = s as unknown as Record<string, unknown> | undefined;
      const c = rec && typeof rec === "object" ? rec["conn"] : undefined;
      if (c && typeof c === "object") {
        return c as {
          transport?: { name?: string };
          on?: (event: string, handler: (...args: unknown[]) => void) => void;
        };
      }
      return undefined;
    }

    const conn = getConn(socket);
    const transport = conn?.transport?.name ?? "unknown";
    const clientSource = isExtension ? "extension" : "browser";

    log.info("socket connection established", {
      socketId: socket.id,
      connectionId,
      clientSource,
      transport,
      origin,
      headers: snapshotHeaders(socket),
      timestamp: new Date().toISOString(),
    });

    withErrorHandler(() => {
      logMetric(
        "socketConnection",
        { clientSource, transport, isExtension },
        { socketId: socket.id, origin },
      );
    }, "socketConnection metric")();

    const handlerEmitter = createSocketEmitter(deps.getIo, {
      source: "connectionHandler",
    });
    try {
      registerSocketHandlers(
        socket,
        { socketId: socket.id, connectionId, requestId },
        {
          musicDB: deps.musicDB,
          io: deps.getIo(),
          emit: (
            ev: string,
            payload: unknown,
            opts?: import("../utils/socketEmitter").EmitOptions,
          ) => handlerEmitter.emit(ev, payload, opts),
          youtubeService: deps.youtubeService,
          manager,
          fileStore: deps.fileStore,
          isAdmin: (h?: string) => {
            try {
              return Boolean(h && h === deps.adminHash);
            } catch (err: unknown) {
              log.warn("isAdmin check failed", { error: err });
              return false;
            }
          },
        },
      );
    } catch (err: unknown) {
      log.error("registerSocketHandlers failed", {
        error: err,
        socketId: socket.id,
      });
      throw err;
    }

    if (isExtension) {
      // Access socket.on defensively: some transports expose different shapes.
      const getSocketOn = (
        s: Socket,
      ): ((...args: unknown[]) => void) | undefined => {
        const rec = s as unknown as Record<string, unknown> | undefined;
        const onVal = rec && typeof rec === "object" ? rec["on"] : undefined;
        if (typeof onVal === "function")
          return (onVal as (...a: unknown[]) => void).bind(s as unknown) as (
            ...a: unknown[]
          ) => void;
        return undefined;
      };

      const maybeSocketOn = getSocketOn(socket);

      if (typeof maybeSocketOn === "function") {
        try {
          maybeSocketOn("upgrade", () => {
            log.info("extension connection upgraded to websocket", {
              socketId: socket.id,
              timestamp: new Date().toISOString(),
            });
          });
        } catch (err: unknown) {
          log.debug("failed to register upgrade handler", {
            error: err,
            socketId: socket.id,
          });
        }

        try {
          maybeSocketOn("upgradeError", (error: unknown) => {
            log.warn(
              "extension websocket upgrade failed, continuing with polling",
              {
                socketId: socket.id,
                error,
                timestamp: new Date().toISOString(),
              },
            );
          });
        } catch (err: unknown) {
          log.debug("failed to register upgradeError handler", {
            error: err,
            socketId: socket.id,
          });
        }
      }
    }

    withErrorHandler(() => {
      socket.onAny((event: string, ...args: unknown[]) => {
        withErrorHandler(() => {
          const safeArgs = sanitizeArgs(args);
          const headers = snapshotHeaders(socket);
          const origin = headers?.origin ?? headers?.referer;
          log.info("socket event received", {
            event,
            args: safeArgs,
            socketId: socket.id,
            origin,
            transport,
          });
        }, "socket event logging")();
      });
    }, "socket onAny setup")();

    withErrorHandler(() => {
      const compatList = deps.getMusicService().buildCompatList();
      log.info("emitting init lists to socket", {
        socketId: socket.id,
        count: compatList.length,
      });
      socket.emit("initMusics", compatList);
      socket.emit("url_list", compatList);
      const serviceResolver = ServiceResolver.getInstance();
      const dependencies = serviceResolver.resolveDependencies(
        {},
      ) as import("../utils/serviceResolver").ServiceDependencies;
      let nodeEnv = "development";
      if (
        dependencies.configService &&
        typeof dependencies.configService.getString === "function"
      )
        nodeEnv =
          dependencies.configService.getString("NODE_ENV") ?? "development";
      if (nodeEnv !== "production") {
        log.info("emitted init events to socket", {
          socketId: socket.id,
          count: compatList.length,
        });
      }
    }, "socket init emit")();

    log.info("socket connected", {
      socketId: socket.id,
      connectionId,
      requestId,
      clientSource,
      transport,
      timestamp: new Date().toISOString(),
    });

    if (isExtension) {
      const maybeSocketOn2 = (():
        | ((...args: unknown[]) => void)
        | undefined => {
        const rec = socket as unknown as Record<string, unknown> | undefined;
        const onVal = rec && typeof rec === "object" ? rec["on"] : undefined;
        if (typeof onVal === "function")
          return (onVal as (...a: unknown[]) => void).bind(
            socket as unknown,
          ) as (...a: unknown[]) => void;
        return undefined;
      })();

      if (typeof maybeSocketOn2 === "function") {
        try {
          maybeSocketOn2("extension_heartbeat", (data: unknown) => {
            try {
              log.debug("extension heartbeat received", {
                socketId: socket.id,
                data,
                timestamp: new Date().toISOString(),
              });
            } catch (err: unknown) {
              log.warn("failed to process extension heartbeat", { error: err });
            }
          });
        } catch (err: unknown) {
          log.debug("failed to register extension_heartbeat", {
            error: err,
            socketId: socket.id,
          });
        }

        try {
          maybeSocketOn2("extension_connected", (data: unknown) => {
            try {
              log.info("extension connected event", {
                socketId: socket.id,
                extensionData: data,
                timestamp: new Date().toISOString(),
              });
            } catch (err: unknown) {
              log.warn("failed to process extension connected event", {
                error: err,
              });
            }
          });
        } catch (err: unknown) {
          log.debug("failed to register extension_connected", {
            error: err,
            socketId: socket.id,
          });
        }

        try {
          maybeSocketOn2("tabs_sync", (data: unknown) => {
            try {
              log.debug("extension tabs sync", {
                socketId: socket.id,
                tabCount: Array.isArray(data) ? data.length : 0,
                timestamp: new Date().toISOString(),
              });
            } catch (err: unknown) {
              log.warn("failed to process tabs sync", { error: err });
            }
          });
        } catch (err: unknown) {
          log.debug("failed to register tabs_sync", {
            error: err,
            socketId: socket.id,
          });
        }

        try {
          maybeSocketOn2("youtube_video_state", async (payload: unknown) => {
            try {
              if (!payload || typeof payload !== "object") {
                log.debug("youtube_video_state: ignored invalid payload", {
                  payload,
                });
                return;
              }
              const p = payload as Record<string, unknown>;
              const stateRaw = p["state"] as string | undefined;
              const url = typeof p["url"] === "string" ? p["url"] : undefined;

              if (stateRaw === "window_close") {
                const status = {
                  type: "closed",
                } as import("~/stores/musicStore").RemoteStatus;
                try {
                  manager.update(status, "extension");
                  log.info(
                    "youtube_video_state processed: window_close -> remote closed",
                    {
                      socketId: socket.id,
                      connectionId,
                    },
                  );
                } catch (e: unknown) {
                  log.warn("failed to update remote status (window_close)", {
                    error: e,
                  });
                }
                return;
              }

              if (stateRaw === "playing" || stateRaw === "paused") {
                const state = stateRaw === "playing" ? "playing" : "paused";
                let match = null as null | { url: string; title?: string };
                if (url) {
                  const { watchUrl } = await import("@/shared/libs/youtube");
                  for (const [, m] of deps.musicDB.entries()) {
                    try {
                      const generated = watchUrl((m as { id: string }).id);
                      if (generated === url) {
                        match = {
                          url: generated,
                          title: (m as { title: string }).title,
                        };
                        break;
                      }
                    } catch (_e: unknown) {
                      void _e;
                    }
                  }
                }

                const remoteStatus = match
                  ? ({
                      type: state,
                      musicTitle: match.title ?? "",
                      musicId: undefined,
                    } as import("~/stores/musicStore").RemoteStatus)
                  : state === "playing"
                    ? ({
                        type: "playing",
                        musicTitle: "",
                        musicId: undefined,
                      } as import("~/stores/musicStore").RemoteStatus)
                    : ({
                        type: "paused",
                      } as import("~/stores/musicStore").RemoteStatus);

                try {
                  manager.update(remoteStatus, "extension");
                  log.info("youtube_video_state processed", {
                    socketId: socket.id,
                    connectionId,
                    state: stateRaw,
                    url,
                    matched: !!match,
                  });
                } catch (e: unknown) {
                  log.warn("failed to update remote status (playing/paused)", {
                    error: e,
                  });
                }
                return;
              }

              log.debug("youtube_video_state: unknown state value", {
                state: stateRaw,
                payload,
              });
            } catch (err: unknown) {
              log.warn("failed to process youtube_video_state", { error: err });
            }
          });
        } catch (err: unknown) {
          log.debug("failed to register youtube_video_state", {
            error: err,
            socketId: socket.id,
          });
        }
      }
    }
  };
}

export default makeConnectionHandler;
