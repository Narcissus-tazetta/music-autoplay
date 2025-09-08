import type { Socket } from "socket.io";
import type { Music } from "~/stores/musicStore";

export default function registerGetAllMusics(
  socket: Socket,
  musicDB: Map<string, Music>,
) {
  socket.on("getAllMusics", (callback: (musics: Music[]) => void) => {
    callback(Array.from(musicDB.values()));
  });
}
