/**
 * Core domain types shared by the server, the React Router app and the extension bridge.
 *
 * These used to live in the zustand music store, which pulled zustand and
 * socket.io-client into the import graph of anything that only needed the shapes.
 */

export type RemoteStatus =
    | {
        type: 'playing';
        musicTitle: string;
        musicId?: string;
        isAdvertisement?: boolean;
        adTimestamp?: number;
        isExternalVideo?: boolean;
        videoId?: string;
        currentTime?: number;
        duration?: number;
        progressPercent?: number;
        lastProgressUpdate?: number;
        consecutiveStalls?: number;
        playbackRate?: number;
        isBuffering?: boolean;
    }
    | {
        type: 'paused';
        musicTitle?: string;
        musicId?: string;
        videoId?: string;
        isTransitioning?: boolean;
        currentTime?: number;
        duration?: number;
        playbackRate?: number;
    }
    | {
        type: 'closed';
    };

export interface Music {
    title: string;
    channelName: string;
    channelId: string;
    id: string;
    duration: string;
    requesterHash?: string;
    requesterName?: string;
    requestedAt?: string;
}
