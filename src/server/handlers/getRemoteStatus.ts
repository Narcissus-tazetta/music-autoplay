import type { Socket } from "socket.io";
import type { RemoteStatus } from "~/stores/musicStore";
import { registerHandler } from "../utils/socketHelpers";

type RemoteStatusSupplier = RemoteStatus | (() => RemoteStatus);

export default function registerGetRemoteStatus(
  socket: Socket,
  remoteStatusOrSupplier: RemoteStatusSupplier,
) {
  registerHandler(
    socket,
    "getRemoteStatus",
    (callback: (state: RemoteStatus) => void) => {
      try {
        if (typeof remoteStatusOrSupplier === "function") {
          const fn = remoteStatusOrSupplier as () => RemoteStatus;
          const state = fn();
          callback(state);
        } else {
          callback(remoteStatusOrSupplier);
        }
      } catch {
        try {
          // swallow provider errors and return closed state as safe fallback
          callback({ type: "closed" });
        } catch {
          // ignore
        }
      }
    },
  );
}
