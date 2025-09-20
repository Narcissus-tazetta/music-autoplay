import { randomUUID } from "crypto";
import type { Socket } from "socket.io";
import type { Server as IOServer } from "socket.io";
import logger, { logMetric, withContext } from "../logger";
import { snapshotHeaders, sanitizeArgs } from "./utils";
import { registerSocketHandlers } from "./handlers";
import type { Store } from "../musicPersistence";
import type MusicService from "../music/musicService";
import type SocketManager from "./manager";
import type { TimerManager } from "../utils/socketHelpers";
import type WindowCloseManager from "../utils/windowCloseManager";
import type { YouTubeService } from "../youtubeService";
import type { Music } from "~/stores/musicStore";

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

export function makeConnectionHandler(deps: ConnectionDeps) {
  return (socket: Socket) => {
    const connectionId = randomUUID();
    const hs = socket.handshake;
    let requestId: string | undefined;
    try {
      if (hs && typeof (hs as any).headers === "object") {
        const hdrs = (hs as { headers?: unknown }).headers as
          | Record<string, unknown>
          | undefined;
        if (hdrs && typeof hdrs["x-request-id"] === "string")
          requestId = hdrs["x-request-id"];
      }
    } catch {
      requestId = undefined;
    }

    const log = withContext({ socketId: socket.id, connectionId, requestId });

    if (!deps.getManager()) {
      deps.createManager();
    }

    const _headersSnapshot = snapshotHeaders(socket);
    const origin =
      _headersSnapshot && typeof _headersSnapshot.origin === "string"
        ? _headersSnapshot.origin
        : undefined;
    const isExtension =
      typeof origin === "string" && origin.startsWith("chrome-extension://");
    type ConnLike = { conn?: { transport?: { name?: string } }; on?: unknown };
    const conn = (socket as unknown as ConnLike).conn;
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

    try {
      logMetric(
        "socketConnection",
        { clientSource, transport, isExtension },
        { socketId: socket.id, origin },
      );
    } catch (err) {
      logger.warn("failed to log connection metric", { error: err });
    }

    registerSocketHandlers(
      socket,
      { socketId: socket.id, connectionId, requestId },
      {
        musicDB: deps.musicDB,
        io: deps.getIo(),
        youtubeService: deps.youtubeService,
        manager: deps.getManager(),
        fileStore: deps.fileStore,
        isAdmin: (h?: string) => Boolean(h && String(h) === deps.adminHash),
      },
    );

    if (isExtension) {
      const connObj = socket as unknown as ConnLike;
      let maybeConnOn: unknown;
      if (connObj && typeof (connObj as ConnLike).on === "function")
        maybeConnOn = (connObj as ConnLike).on;

      if (typeof maybeConnOn === "function") {
        (maybeConnOn as (ev: string, handler: () => void) => void).call(
          connObj,
          "upgrade",
          () => {
            logger.info("extension connection upgraded to websocket", {
              socketId: socket.id,
              timestamp: new Date().toISOString(),
            });
          },
        );

        (
          maybeConnOn as (ev: string, handler: (err: unknown) => void) => void
        ).call(connObj, "upgradeError", (error: unknown) => {
          logger.warn(
            "extension websocket upgrade failed, continuing with polling",
            {
              socketId: socket.id,
              error,
              timestamp: new Date().toISOString(),
            },
          );
        });
      }
    }

    try {
      socket.onAny((event: string, ...args: unknown[]) => {
        try {
          const safeArgs = sanitizeArgs(args);
          const headers = snapshotHeaders(socket);
          const origin = headers?.origin ?? headers?.referer;
          logger.info("socket event received", {
            event,
            args: safeArgs,
            socketId: socket.id,
            origin,
          });
        } catch (err) {
          logger.warn("failed to serialize socket event args", { error: err });
        }
      });
    } catch (err) {
      logger.warn("failed to attach onAny logger to socket", { error: err });
    }

    // emit initialization events (compat)
    try {
      const compatList = deps.getMusicService().buildCompatList();
      logger.info("emitting init lists to socket", {
        socketId: socket.id,
        count: compatList.length,
      });
      socket.emit("initMusics", compatList);
      socket.emit("url_list", compatList);
      if (process.env.NODE_ENV !== "production") {
        logger.info("emitted init events to socket", {
          socketId: socket.id,
          count: compatList.length,
        });
      }
    } catch (err) {
      logger.warn("failed to emit legacy init events", { error: err });
    }

    logger.info("socket connected", {
      socketId: socket.id,
      connectionId,
      requestId,
      clientSource,
      transport,
      timestamp: new Date().toISOString(),
    });

    if (isExtension) {
      const sockObj = socket as unknown as ConnLike;
      let maybeSockOn: unknown;
      if (sockObj && typeof (sockObj as ConnLike).on === "function")
        maybeSockOn = (sockObj as ConnLike).on;

      if (typeof maybeSockOn === "function") {
        (
          maybeSockOn as (ev: string, handler: (data: unknown) => void) => void
        ).call(sockObj, "extension_heartbeat", (data: unknown) => {
          try {
            logger.debug("extension heartbeat received", {
              socketId: socket.id,
              data,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            logger.warn("failed to process extension heartbeat", {
              error: err,
            });
          }
        });

        (
          maybeSockOn as (ev: string, handler: (data: unknown) => void) => void
        ).call(sockObj, "extension_connected", (data: unknown) => {
          try {
            logger.info("extension connected event", {
              socketId: socket.id,
              extensionData: data,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            logger.warn("failed to process extension connected event", {
              error: err,
            });
          }
        });

        (
          maybeSockOn as (ev: string, handler: (data: unknown) => void) => void
        ).call(sockObj, "tabs_sync", (data: unknown) => {
          try {
            logger.debug("extension tabs sync", {
              socketId: socket.id,
              tabCount: Array.isArray(data) ? (data as unknown[]).length : 0,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            logger.warn("failed to process tabs sync", { error: err });
          }
        });
      }
    }
  };
}

export default makeConnectionHandler;

/* 注意: このファイルでは、型の厳密化を段階的に進めるため、一時的にeslintルールを緩和しています。 */
