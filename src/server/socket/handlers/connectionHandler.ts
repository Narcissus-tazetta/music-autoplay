import type { Music } from "@/shared/stores/musicStore";
import { withErrorHandler } from "@/shared/utils/errors";
import { randomUUID } from "crypto";
import type { Socket } from "socket.io";
import type { Server as IOServer } from "socket.io";
import logger, { logMetric, withContext } from "../../logger";
import type { MusicService } from "../../music/musicService";
import type { Store } from "../../persistence";
import type { RateLimiter } from "../../services/rateLimiter";
import type { WindowCloseManager } from "../../services/windowCloseManager";
import type { YouTubeService } from "../../services/youtubeService";
import type { EmitOptions } from "../../utils/safeEmit";
import { createSocketEmitter } from "../../utils/safeEmit";
import type { TimerManager } from "../../utils/timerManager";
import type { SocketManager } from "../managers/manager";
import { snapshotHeaders } from "../utils";
import { extractSocketOn, extractTransportName } from "../utils/socketHelpers";
import { setupExtensionEventHandlers } from "./extensionEventHandlers";
import { registerSocketHandlers } from "./handlers";
import { emitInitialData } from "./initEmitter";
import { setupSocketLogging } from "./socketLogging";

export type ConnectionDeps = {
  getIo: () => IOServer;
  getMusicService: () => MusicService;
  getManager: () => SocketManager | undefined;
  createManager: () => SocketManager;
  musicDB: Map<string, Music>;
  youtubeService: YouTubeService;
  fileStore: Store;
  adminHash: string;
  rateLimiter?: RateLimiter;
  rateLimitConfig?: {
    maxAttempts: number;
    windowMs: number;
  };
  timerManager: TimerManager;
  windowCloseManager: InstanceType<typeof WindowCloseManager>;
};

export type ConnectionHandlerFactory = (
  deps: ConnectionDeps,
) => (socket: Socket) => void;

export function makeConnectionHandler(
  deps: ConnectionDeps,
): (socket: Socket) => void {
  return (socket: Socket): void => {
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

    const transport = extractTransportName(socket);
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
          emit: (ev: string, payload: unknown, opts?: EmitOptions) =>
            handlerEmitter.emit(ev, payload, opts),
          youtubeService: deps.youtubeService,
          manager,
          fileStore: deps.fileStore,
          isAdmin: (h?: string) => {
            try {
              return !!(h && h === deps.adminHash);
            } catch (err: unknown) {
              log.warn("isAdmin check failed", { error: err });
              return false;
            }
          },
          adminHash: deps.adminHash,
          rateLimiter: deps.rateLimiter,
          rateLimitConfig: deps.rateLimitConfig,
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
      const maybeSocketOn = extractSocketOn(socket);

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

    setupSocketLogging(socket, log, transport);
    emitInitialData(socket, log, deps.getMusicService);

    log.info("socket connected", {
      socketId: socket.id,
      connectionId,
      requestId,
      clientSource,
      transport,
      timestamp: new Date().toISOString(),
    });

    if (isExtension) {
      const musicService = deps.getMusicService();
      setupExtensionEventHandlers(
        socket,
        log,
        connectionId,
        deps.musicDB,
        manager,
        musicService.repository,
        musicService.emitter,
        deps.youtubeService,
      );
    }
  };
}

export default makeConnectionHandler;
