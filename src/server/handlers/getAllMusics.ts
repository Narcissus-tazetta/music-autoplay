import type { Socket } from "socket.io";
import type { Music } from "~/stores/musicStore";
import { registerHandler } from "../utils/socketHelpers";
import logger from "@/server/logger";

export default function registerGetAllMusics(
  socket: Socket,
  musicDB: Map<string, Music>,
) {
  registerHandler(
    socket,
    "getAllMusics",
    (callback: (musics: Music[]) => void) => {
      const start = Date.now();
      try {
        const list = Array.from(musicDB.values());
        logger.info("getAllMusics handler invoked", {
          socketId: socket.id,
          count: list.length,
        });
        // update metrics if available on global
        try {
          const m = (globalThis as any).__simpleMetrics;
          if (m && m.rpcGetAllMusics) {
            m.rpcGetAllMusics.calls++;
            m.rpcGetAllMusics.totalMs += Date.now() - start;
          }
        } catch (e) {
          void e;
        }
        callback(list);
      } catch (e: unknown) {
        logger.warn("getAllMusics handler failed", { error: e });
        try {
          const m = (globalThis as any).__simpleMetrics;
          if (m && m.rpcGetAllMusics) {
            m.rpcGetAllMusics.errors++;
            m.rpcGetAllMusics.totalMs += Date.now() - start;
          }
        } catch (err) {
          void err;
        }
        callback([]);
      }
    },
  );
}
