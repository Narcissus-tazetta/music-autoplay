import type { Socket } from "socket.io";
import type { RemoteStatus } from "~/stores/musicStore";

export default function registerGetRemoteStatus(
  socket: Socket,
  remoteStatus: RemoteStatus,
) {
  socket.on("getRemoteStatus", (callback: (state: RemoteStatus) => void) => {
    callback(remoteStatus);
  });
}
