import type { C2S, S2C } from "@/shared/types/socket";
import { Server as HttpServer } from "http";
import { createHash } from "crypto";
import { Server } from "socket.io";
import type { Server as IOServer } from "socket.io";
import type { Music, RemoteStatus } from "~/stores/musicStore";
import { YouTubeService } from "./youtubeService";
import { SERVER_ENV } from "~/env.server";
import { buildCorsConfig, makeOriginChecker } from "./socket/cors";
import { defaultFileStore } from "./musicPersistence";
import type { Store } from "./musicPersistence";
import logger from "./logger";
import { RateLimiter } from "./socket/utils";
import type { ReplyOptions } from "./socket/types";
import { TimerManager } from "./utils/socketHelpers";
import WindowCloseManager from "./utils/windowCloseManager";
import SocketManager from "./socket/manager";
import MusicService from "./music/musicService";
import { isObject } from "./socket/utils";
import type { EngineLike, RequestLike } from "./socket/types";
import {
  attachUpgradeRewrite,
  registerEngineAugmentations,
} from "./socket/engine";

export class SocketServerInstance {
  musicDB: Map<string, Music> = new Map();
  remoteStatus: RemoteStatus = {
    type: "closed",
  };
  private adminHash: string;

  io?: Server<C2S, S2C>;
  youtubeService: YouTubeService;
  fileStore: Store;
  private remoteStatusUpdatedAt = 0;
  private remoteStatusDebounceMs = Number(
    SERVER_ENV.REMOTE_STATUS_DEBOUNCE_MS || 250,
  );
  private remoteStatusGraceMs = Number(
    SERVER_ENV.REMOTE_STATUS_GRACE_MS || 5000,
  );
  private remoteStatusInactivityMs = Number(
    SERVER_ENV.REMOTE_STATUS_INACTIVITY_MS || 1000 * 60 * 10,
  );
  private timerManager = new TimerManager();
  private windowCloseManager = new WindowCloseManager(
    Number(SERVER_ENV.WINDOW_CLOSE_DEBOUNCE_MS || 500),
  );
  private manager?: SocketManager;
  private musicService?: MusicService;
  private adminRateLimiter = new RateLimiter(
    Number(process.env.ADMIN_MAX_ATTEMPTS ?? 5),
    Number(process.env.ADMIN_WINDOW_MS ?? 60000),
  );
  static isEngineLike(v: unknown): v is EngineLike {
    if (!isObject(v)) return false;
    /* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion */
    const rec = v as Record<string, unknown>;
    return (
      typeof rec["on"] === "function" ||
      typeof rec["httpServer"] !== "undefined"
    );
  }
  static getEngineFromIo(io: unknown): unknown {
    if (!isObject(io)) return undefined;
    /* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion */
    return (io as Record<string, unknown>)["engine"];
  }
  // Backwards-compatible alias used heavily across the file during incremental refactor
  static isObject: (v: unknown) => v is Record<string, unknown> = isObject;

  // Extract Origin header from various request shapes used by engine.io
  private getOriginFromReq(req: unknown): string | undefined {
    try {
      if (!isObject(req)) return undefined;
      const headers = (req as RequestLike).headers;
      if (isObject(headers) && typeof headers.origin === "string")
        return headers.origin;
      if (isObject(req) && typeof (req as RequestLike).url === "string")
        return undefined;
      return undefined;
    } catch {
      return undefined;
    }
  }

  // constructor is intentionally lightweight. Callers should call `await init(server)`
  // to perform async/IO initialization. Keeping constructor minimal helps testing
  // and avoids accidental early binding to HTTP servers.
  constructor(
    youtubeService?: YouTubeService,
    fileStore: Store = defaultFileStore,
  ) {
    this.youtubeService = youtubeService ?? new YouTubeService();
    this.fileStore = fileStore;
    this.adminHash = createHash("sha256")
      .update(String(SERVER_ENV.ADMIN_SECRET))
      .digest("hex");
  }

  // Initialize with an existing HTTP server. Idempotent: calling multiple times
  // will be a no-op after the first successful init.
  async init(server: HttpServer): Promise<void> {
    // ensure there is at least one await to satisfy linter for async functions
    await Promise.resolve();
    if (this.io) return;

    // Respect configured socket path but accept a few legacy prefixes for compatibility
    const socketPath = SERVER_ENV.SOCKET_PATH || "/api/socket.io";
    const candidatePrefixes = Array.from(
      new Set([socketPath, "/socket.io", "/api/socket.io"].filter(Boolean)),
    );
    attachUpgradeRewrite(server, socketPath, candidatePrefixes);

    const { origins, allowAllOrigins, allowExtensionOrigins } =
      buildCorsConfig();

    // Create socket.io server bound to the configured path. Because we
    // rewrote upgrade URLs above, legacy client attempts will be routed
    // correctly to this path.
    // Attach HTTP server error/listening handlers to help diagnose issues
    // like "Port undefined is already in use" which can be emitted by
    // underlying websocket implementations or dev servers.
    try {
      try {
        const addr = (
          server as unknown as { address?: () => unknown }
        ).address?.();
        logger.info("http server address info (pre-socket init)", { addr });
      } catch (e) {
        void e;
      }
      (server as unknown as NodeJS.EventEmitter).on("error", (err: unknown) => {
        try {
          logger.error("http server error event", { error: err });
        } catch (e) {
          void e;
        }
      });

      this.io = new Server<C2S, S2C>(server, {
        path: socketPath,
        // Enhanced polling configuration for extension stability
        pingTimeout: 60000,
        pingInterval: 25000,
        upgradeTimeout: 30000,
        allowEIO3: true,
        transports: ["polling", "websocket"],
        cors: allowAllOrigins
          ? { origin: true, credentials: true }
          : {
              origin: makeOriginChecker({
                origins,
                allowAllOrigins,
                allowExtensionOrigins,
              }),
              credentials: true,
            },
      });
    } catch (err) {
      logger.error("socket.io initialization failed", { error: err });
      throw err;
    }
    try {
      this.io.on("error", (err: unknown) => {
        try {
          logger.error("socket.io error event", { error: err });
        } catch (e) {
          void e;
        }
      });
    } catch (e) {
      void e;
    }
    try {
      const engine: unknown = SocketServerInstance.getEngineFromIo(this.io);
      const socketPath = SERVER_ENV.SOCKET_PATH || "/api/socket.io";
      logger.info("DEBUG: Socket path configuration", {
        "SERVER_ENV.SOCKET_PATH": SERVER_ENV.SOCKET_PATH,
        "socketPath (computed)": socketPath,
        "process.env.SOCKET_PATH": process.env.SOCKET_PATH,
      });
      if (SocketServerInstance.isEngineLike(engine)) {
        try {
          registerEngineAugmentations(engine, socketPath);
        } catch (err) {
          logger.debug("failed to register engine augmentations", {
            error: err,
          });
        }
      }
    } catch (err) {
      logger.debug("failed to register engine.io header augmentation", {
        error: err,
      });
    }
    // restore persisted musics
    try {
      const persisted = this.fileStore.load();
      for (const m of persisted) this.musicDB.set(m.id, m);
      logger.info("restored persisted musics", { count: persisted.length });
      if (SERVER_ENV.NODE_ENV !== "production") {
        try {
          const sample = persisted.slice(0, 5).map((m) => m.id);
          logger.info("restored persisted musics sample ids", { sample });
        } catch (e) {
          logger.warn("failed to log persisted musics sample", { error: e });
        }
      }
    } catch (err: unknown) {
      logger.warn("failed to restore persisted musics", { error: err });
    }

    // attach connection handlers (extracted)
    type AnyConnectionHandler = (deps: {
      getIo: () => IOServer;
      getMusicService: () => unknown;
      getManager: () => unknown | undefined;
      createManager: () => unknown;
      musicDB: Map<string, Music>;
      youtubeService: unknown;
      fileStore: Store;
      adminHash: string;
      timerManager: TimerManager;
      windowCloseManager: unknown;
    }) => (socket: unknown) => void;
    const mod = await import("./socket/connectionHandler");
    const makeConnectionHandler =
      mod.default as unknown as AnyConnectionHandler;
    const handler = makeConnectionHandler({
      getIo: () => this.getIo(),
      getMusicService: () => this.getMusicService(),
      getManager: () => this.manager,
      createManager: () => {
        if (!this.manager) {
          this.manager = new SocketManager(
            (ev: string, payload: unknown) => {
              try {
                const io = this.getIo();
                (io.emit as unknown as (e: string, p: unknown) => void)(
                  ev,
                  payload,
                );
              } catch (e) {
                logger.warn("failed to emit from manager", { error: e });
              }
            },
            this.timerManager,
            this.windowCloseManager,
            {
              debounceMs: this.remoteStatusDebounceMs,
              graceMs: this.remoteStatusGraceMs,
              inactivityMs: this.remoteStatusInactivityMs,
            },
          );
        }
        return this.manager as any;
      },
      musicDB: this.musicDB,
      youtubeService: this.youtubeService,
      fileStore: this.fileStore,
      adminHash: this.adminHash,
      timerManager: this.timerManager,
      windowCloseManager: this.windowCloseManager,
    });
    this.io.on("connection", handler);
  }

  async close(): Promise<void> {
    try {
      if (!this.io) return;
      await new Promise<void>((resolve) => {
        try {
          // bind io to a local variable to avoid unbound-method lint errors
          const io = this.getIo();
          void io.close(() => {
            try {
              logger.info("socket.io closed");
            } catch (err) {
              void err;
            }
            resolve();
          });
        } catch (err) {
          logger.warn("socket.io close failed synchronously", { error: err });
          resolve();
        }
      });
    } catch (e) {
      logger.warn("error while closing socket.io", { error: e });
    }
  }

  // Public emit helper so the instance can be passed where a lightweight
  // `{ emit: (...) => void }` is expected (e.g. request load context).
  // This delegates to the initialized socket.io server if present and
  // swallows errors to avoid crashing request handlers.
  // compatibility overload so this instance can be used where a minimal `{ emit: (...args: unknown[]) => void }` is expected
  public emit(...args: unknown[]): void;
  public emit(
    ...args: Parameters<IOServer["emit"]>
  ): ReturnType<IOServer["emit"]> | undefined {
    try {
      // Use getIo which guarantees initialized and returns a typed IOServer
      const ioServer = this.getIo();
      return (
        ioServer.emit as unknown as (
          ...a: Parameters<IOServer["emit"]>
        ) => ReturnType<IOServer["emit"]>
      )(...args);
    } catch (e) {
      logger.warn("SocketServerInstance.emit failed", { error: e });
    }
  }

  // Safe accessor that ensures the socket server has been initialized.
  private getIo(): IOServer {
    if (!this.io)
      throw new Error("SocketServerInstance not initialized (call init first)");
    return this.io as unknown as IOServer;
  }

  // NOTE: header snapshot and args sanitization are now provided by
  // `src/server/socket/utils.ts` and imported at the top of the file.

  // musicService helper (lazy)
  private getMusicService(): MusicService {
    if (!this.musicService) {
      this.musicService = new MusicService(
        this.musicDB,
        this.youtubeService,
        this.fileStore,
        (ev, payload) => {
          try {
            const io = this.getIo();
            (io.emit as unknown as (e: string, p: unknown) => void)(
              ev,
              payload,
            );
          } catch (e) {
            logger.warn("failed to emit from musicService", { error: e });
          }
        },
      );
    }
    return this.musicService;
  }

  // handler registration has been extracted to `src/server/socket/handlers.ts`

  async addMusic(url: string, requesterHash?: string): Promise<ReplyOptions> {
    return this.getMusicService().addMusic(url, requesterHash);
  }

  removeMusic(url: string, requesterHash: string): ReplyOptions {
    return this.getMusicService().removeMusic(url, requesterHash);
  }
}
