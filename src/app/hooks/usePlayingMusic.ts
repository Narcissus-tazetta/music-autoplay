import type { Music, RemoteStatus } from "@/shared/stores/musicStore";

export function usePlayingMusic(
  musics: Music[],
  remoteStatus: RemoteStatus | null,
): Music | undefined {
  if (!remoteStatus) return undefined;
  if (remoteStatus.type !== "playing") return undefined;

  if (
    typeof remoteStatus.musicId === "string" &&
    remoteStatus.musicId.length > 0
  ) {
    return musics.find((m) => m.id === remoteStatus.musicId);
  }

  return musics.find((m) => m.title === remoteStatus.musicTitle);
}

export default usePlayingMusic;
