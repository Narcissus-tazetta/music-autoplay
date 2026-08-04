import type { Music, RemoteStatus } from '@/shared/stores/musicStore';
import type { Socket } from 'socket.io';
import type { HistoryService } from '../../history/historyService';
import type { AppLogger } from '../../logger';
import type { MusicEventEmitter } from '../../music/emitter/musicEventEmitter';
import type { MusicRepository } from '../../music/repository/musicRepository';
import type { YouTubeService } from '../../services/youtubeService';
import type { SocketManager } from '../managers/manager';
import { registerSocketEventSafely } from '../utils/eventRegistration';
import { extractSocketOn } from '../utils/socketHelpers';

export type ProgressSnapshot = {
    timestamp: number;
    seq?: number;
    currentTime: number;
    duration: number;
    progressPercent?: number;
    playbackRate?: number;
    isBuffering?: boolean;
    consecutiveStalls?: number;
    isAdvertisement?: boolean;
    musicTitle?: string;
    clientLatencyMs?: number;
};

export type AuthoritativeVideoState = {
    state: 'playing' | 'paused';
    receivedAt: number;
    seq?: number;
    currentTime?: number;
    duration?: number;
};

export type AdSnapshot = {
    isAdvertisement: boolean;
    adTimestamp?: number;
};

export type PendingNext = {
    videoId: string;
    nextCandidateId?: string;
    createdAt: number;
};

export type ProgressTrackingState = {
    lastTime: number;
    lastTimestamp: number;
    consecutiveStalls: number;
    lastAdDecisionAt: number;
};

/**
 * Per-connection mutable state shared between the extension handler modules.
 * Every map here is cleared on disconnect (see setupExtensionEventHandlers).
 */
export type ExtensionSessionState = {
    authoritativeVideoState: Map<string, AuthoritativeVideoState>;
    historyCompletionRecordedAtByVideoId: Map<string, number>;
    lastAdSnapshotByVideoId: Map<string, AdSnapshot>;
    lastProgressSnapshotByVideoId: Map<string, ProgressSnapshot>;
    pendingNextByTabId: Map<number, PendingNext>;
    progressState: Map<string, ProgressTrackingState>;
    recordableMusicSnapshotByVideoId: Map<string, Music>;
    videoEndDebounce: Map<string, number>;
};

export const createExtensionSessionState = (): ExtensionSessionState => ({
    authoritativeVideoState: new Map(),
    historyCompletionRecordedAtByVideoId: new Map(),
    lastAdSnapshotByVideoId: new Map(),
    lastProgressSnapshotByVideoId: new Map(),
    pendingNextByTabId: new Map(),
    progressState: new Map(),
    recordableMusicSnapshotByVideoId: new Map(),
    videoEndDebounce: new Map(),
});

export type HistoryRecorder = {
    rememberRecordableMusic: (music: Music | undefined) => void;
    recordCompletedHistory: (videoId: string | undefined, reason: string, musicHint?: Music) => boolean;
    isCompletionProgress: (currentTime: number, duration: number) => boolean;
    clearHistoryCompletionIfReplayStarted: (
        videoId: string | undefined,
        currentTime: number | undefined,
        duration: number | undefined,
        reason: string,
    ) => void;
};

export type ExtensionHandlerDeps = {
    socket: Socket;
    log: AppLogger;
    connectionId: string;
    manager: SocketManager;
    repository: MusicRepository;
    emitter: MusicEventEmitter;
    youtubeService: YouTubeService;
    historyService: HistoryService;
};

export type ExtensionContextBase = ExtensionHandlerDeps & {
    socketOn: ((...args: unknown[]) => void) | undefined;
    socketContext: { socketId: string };
    state: ExtensionSessionState;
};

export type ExtensionContext = ExtensionContextBase & {
    history: HistoryRecorder;
};

export const createExtensionContextBase = (deps: ExtensionHandlerDeps): ExtensionContextBase => ({
    ...deps,
    socketContext: { socketId: deps.socket.id },
    socketOn: extractSocketOn(deps.socket),
    state: createExtensionSessionState(),
});

export type ExtensionEventRegistrar = (
    eventName: string,
    handler: (data: unknown) => void | Promise<void>,
) => void;

export const createEventRegistrar = (ctx: ExtensionContextBase): ExtensionEventRegistrar => (eventName, handler) =>
    registerSocketEventSafely(ctx.socketOn, eventName, handler, ctx.log, ctx.socketContext);

export const isSameVideoOrUnknown = (
    current: RemoteStatus,
    videoId: string,
): boolean => {
    if (current.type !== 'playing' && current.type !== 'paused') return false;

    // Backward-compatible: some callers/tests return a minimal currentStatus without IDs.
    if (!current.musicId && !current.videoId) return true;

    return current.musicId === videoId || current.videoId === videoId;
};

export const indexOfMusicById = (musicList: Music[], id: string): number => {
    for (let i = 0; i < musicList.length; i++) if (musicList[i].id === id) return i;
    return -1;
};

export const shouldReplaceProgressSnapshot = (
    prev: ProgressSnapshot | undefined,
    next: ProgressSnapshot,
): boolean => {
    if (!prev) return true;
    if (next.timestamp > prev.timestamp) return true;
    if (next.timestamp < prev.timestamp) return false;

    const prevSeq = typeof prev.seq === 'number' ? prev.seq : -Infinity;
    const nextSeq = typeof next.seq === 'number' ? next.seq : -Infinity;
    return nextSeq > prevSeq;
};
