import logger from "@/server/logger";
import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { SERVER_ENV } from "~/env.server";
import { container } from "../di/container";
import { buildCorsConfig, makeOriginChecker } from "./cors";
import { attachUpgradeRewrite, registerEngineAugmentations } from "./engine";

export type CreatedIo = {
  io: Server | null;
  socketPath: string;
};

export function createSocketIo(server: HttpServer): CreatedIo {
  const cfg = container.getOptional("configService") as
    | { getString?(key: string): string }
    | undefined;
  const rawSocketPath =
    cfg?.getString?.("SOCKET_PATH") ?? SERVER_ENV.SOCKET_PATH;
  const socketPath =
    typeof rawSocketPath === "string" && rawSocketPath.length > 0
      ? rawSocketPath
      : "/api/socket.io";
  const candidatePrefixes = Array.from(
    new Set([socketPath, "/socket.io", "/api/socket.io"].filter(Boolean)),
  );
  try {
    attachUpgradeRewrite(server, socketPath, candidatePrefixes);
  } catch (e: unknown) {
    logger.warn("attachUpgradeRewrite failed", { error: e });
  }

  const { origins, allowAllOrigins, allowExtensionOrigins } = buildCorsConfig();

  try {
    const io = new Server(server, {
      path: socketPath,
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      allowEIO3: true,
      transports: ["polling", "websocket"],
      serveClient: false,
      allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowAllOrigins) {
          callback(null, true);
          return;
        }

        const isAllowed =
          origins.includes(origin) ||
          (allowExtensionOrigins && origin.startsWith("chrome-extension://"));

        callback(null, isAllowed);
      },
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

    try {
      const ioWithEngine = io as { engine?: unknown };
      const engine = ioWithEngine.engine;
      try {
        if (engine) registerEngineAugmentations(engine, socketPath);
      } catch (err: unknown) {
        logger.debug("failed to register engine augmentations", { error: err });
      }
    } catch (err: unknown) {
      logger.debug("failed to register engine augmentations (outer)", {
        error: err,
      });
    }

    return { io, socketPath };
  } catch (err: unknown) {
    logger.error("socket.io initialization failed", { error: err });
    return { io: null, socketPath };
  }
}

export default createSocketIo;
