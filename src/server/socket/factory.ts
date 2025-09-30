import { SERVER_ENV } from "@/app/env.server";
import type { Server as HttpServer } from "http";
import type { Server as IOServer } from "socket.io";
import type { Music } from "~/stores/musicStore";
import logger from "../logger";
import type { Store } from "../persistence";
import { safeNumber } from "../utils/configUtils";
import ServiceResolver from "../utils/serviceResolver";
import { TimerManager } from "../utils/socketHelpers";
import WindowCloseManager from "../utils/windowCloseManager";
import { YouTubeService } from "../youtubeService";
import type { ConnectionHandlerFactory } from "./connectionHandler";
import { createSocketIo } from "./createSocketIo";
import SocketRuntime from "./runtime";

export type RuntimeOptions = {
  debounceMs: number;
  graceMs: number;
  inactivityMs: number;
};

export type InitSocketServerResult = {
  io: IOServer;
  runtime: SocketRuntime;
  socketPath: string;
};
/**
 * socket.io を初期化し、永続化されたデータを復元し、ランタイムを設定して接続ハンドラを登録しています。
 */
export async function initSocketServer(
  server: HttpServer,
  deps: {
    musicDB: Map<string, Music>;
    fileStore?: Store;
    youtubeService?: YouTubeService;
    adminHash?: string;
    opts: RuntimeOptions;
  },
): Promise<InitSocketServerResult> {
  const { musicDB, fileStore, youtubeService, adminHash, opts } = deps;

  const serviceResolver = ServiceResolver.getInstance();
  const effectiveFileStore =
    fileStore ?? serviceResolver.resolve<Store>("fileStore");
  const effectiveYoutube =
    youtubeService ?? serviceResolver.resolve<YouTubeService>("youtubeService");
  const effectiveAdminHash =
    adminHash ?? serviceResolver.resolve<string>("adminHash");

  const created = createSocketIo(server);
  if (!created.io) throw new Error("failed to initialize socket.io");
  const io = created.io;

  const [persistedData, timerManager, configService] = await Promise.all([
    (async () => {
      try {
        const persisted = effectiveFileStore ? effectiveFileStore.load() : [];
        return persisted;
      } catch (err: unknown) {
        const { extractErrorInfo } = await import("../utils/errorHandling");
        const info = extractErrorInfo(err);
        logger.warn("failed to restore persisted musics", { error: info });
        return [];
      }
    })(),
    Promise.resolve(new TimerManager()),
    Promise.resolve(
      serviceResolver.resolve<import("../services/configService").default>(
        "configService",
      ),
    ),
  ]);

  for (const m of persistedData) musicDB.set(m.id, m);
  logger.info("restored persisted musics", { count: persistedData.length });

  const windowCloseDebounce = safeNumber(
    configService?.getNumber("WINDOW_CLOSE_DEBOUNCE_MS"),
    safeNumber(SERVER_ENV.WINDOW_CLOSE_DEBOUNCE_MS, 500),
  );
  const windowCloseManager = new WindowCloseManager(windowCloseDebounce);

  const { defaultFileStore } = await import("../persistence");
  const yt = effectiveYoutube ?? new YouTubeService();
  const fsToUse = effectiveFileStore ?? defaultFileStore;

  const runtime = new SocketRuntime(
    () => io,
    musicDB,
    yt,
    fsToUse,
    timerManager,
    windowCloseManager,
    opts,
  );

  const mod = (await import("./connectionHandler")) as Partial<{
    default: ConnectionHandlerFactory;
    makeConnectionHandler: ConnectionHandlerFactory;
  }>;
  const makeConnectionHandler: ConnectionHandlerFactory =
    mod.default ?? (mod.makeConnectionHandler as ConnectionHandlerFactory);

  const handler = makeConnectionHandler({
    getIo: () => io,
    getMusicService: () => runtime.getMusicService(),
    getManager: () => runtime.getManager(),
    createManager: () => runtime.createManager(),
    musicDB,
    youtubeService: yt,
    fileStore: effectiveFileStore ?? fsToUse,
    adminHash: effectiveAdminHash ?? "",
    timerManager,
    windowCloseManager,
  });

  io.on("connection", handler);

  return { io, runtime, socketPath: created.socketPath };
}

export default initSocketServer;
