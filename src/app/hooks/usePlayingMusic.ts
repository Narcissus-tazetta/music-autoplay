import { useMemo } from "react";
import type { RemoteStatus, Music } from "~/stores/musicStore";

export function usePlayingMusic(musics: Music[], remoteStatus: RemoteStatus) {
    return useMemo<Music | undefined>(() => {
        if (remoteStatus.type !== "playing") return undefined;
        const status = remoteStatus as Extract<RemoteStatus, { type: "playing" }>;
        if (typeof status.musicId === "string" && status.musicId.length > 0) {
            return musics.find((m) => m.id === status.musicId);
        }
        return musics.find((m) => m.title === status.musicTitle);
    }, [musics, remoteStatus]);
}

export default usePlayingMusic;
