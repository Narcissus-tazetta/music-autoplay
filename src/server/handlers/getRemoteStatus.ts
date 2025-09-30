import logger from "@/server/logger";
import type { Socket } from "socket.io";
import type { RemoteStatus } from "~/stores/musicStore";
import { wrapAsync } from "../utils/errorHandlers";
import { registerTypedHandler } from "../utils/socketHelpers";

type RemoteStatusSupplier = RemoteStatus | (() => RemoteStatus);

export default function registerGetRemoteStatus(
  socket: Socket,
  remoteStatusOrSupplier: RemoteStatusSupplier,
) {
  registerTypedHandler(
    socket,
    "getRemoteStatus",
    wrapAsync((callback: (state: RemoteStatus) => void) => {
      try {
        if (typeof remoteStatusOrSupplier === "function") {
          const fn = remoteStatusOrSupplier as () => RemoteStatus;
          const state = fn();
          callback(state);
        } else {
          callback(remoteStatusOrSupplier);
        }
      } catch (e: unknown) {
        try {
          callback({ type: "closed" });
        } catch (err: unknown) {
          logger.warn(
            "getRemoteStatus: failed to deliver fallback closed state to callback",
            {
              error: err,
            },
          );
        }
        logger.warn("getRemoteStatus handler failed", { error: e });
      }
    }, "getRemoteStatus handler"),
  );
}
