import type { Music, RemoteStatus } from '@/shared/types/music';
import { isRecord } from '@/shared/utils/typeGuards';
import { watchUrl } from '@/shared/utils/youtube';
import type { Socket } from 'socket.io';
import type { HistoryService } from '../../history/historyService';
import type { AppLogger } from '../../logger.server';
import type { MusicEventEmitter } from '../../music/musicEventEmitter';
import type { MusicRepository } from '../../music/musicRepository';
import type { YouTubeService } from '../../services/youtubeService';
import type { SocketManager } from '../managers/manager';
import { registerSocketEventSafely } from '../utils/eventRegistration';

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

type AuthoritativeVideoState = {
    state: 'playing' | 'paused';
    receivedAt: number;
    seq?: number;
    currentTime?: number;
    duration?: number;
};

type AdSnapshot = {
    isAdvertisement: boolean;
    adTimestamp?: number;
};

type PendingNext = {
    videoId: string;
    nextCandidateId?: string;
    createdAt: number;
};

type ProgressTrackingState = {
    lastTime: number;
    lastTimestamp: number;
    consecutiveStalls: number;
    lastAdDecisionAt: number;
};

/**
 * How many videos of per-connection history each map keeps. A connection that stays open
 * across a long playlist would otherwise accumulate one entry per video for its whole life;
 * only the video being played and its immediate neighbours are ever read back.
 */
const MAX_TRACKED_VIDEOS = 200;

/**
 * Inserts into a per-video map, evicting the oldest entries once the cap is reached.
 * Maps iterate in insertion order, so the first key is the least recently added.
 */
export const trackByVideo = <K, V>(map: Map<K, V>, key: K, value: V): void => {
    map.delete(key);
    map.set(key, value);
    while (map.size > MAX_TRACKED_VIDEOS) {
        const oldest = map.keys().next();
        if (oldest.done) break;
        map.delete(oldest.value);
    }
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

const createExtensionSessionState = (): ExtensionSessionState => ({
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
    socketContext: { socketId: string };
    state: ExtensionSessionState;
};

export type ExtensionContext = ExtensionContextBase & {
    history: HistoryRecorder;
};

export const createExtensionContextBase = (deps: ExtensionHandlerDeps): ExtensionContextBase => ({
    ...deps,
    socketContext: { socketId: deps.socket.id },
    state: createExtensionSessionState(),
});

export type ExtensionEventRegistrar = (
    eventName: string,
    handler: (data: unknown) => void | Promise<void>,
) => void;

export const createEventRegistrar = (ctx: ExtensionContextBase): ExtensionEventRegistrar => (eventName, handler) =>
    registerSocketEventSafely(ctx.socket, eventName, handler, ctx.log, ctx.socketContext);

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

/** The queue is a loop: the entry after the last one is the first one. */
export const nextIndexWithWrap = (musicList: Music[], index: number): number => (index + 1) % musicList.length;

/**
 * Pulls the `{ url, tabId }` pair every extension playback event carries, logging and
 * returning null on anything malformed. tabId 0 is rejected along with the missing case —
 * Chrome never assigns it, so the handlers have always treated it as absent.
 */
export const extractUrlAndTabId = (
    payload: unknown,
    eventName: string,
    log: AppLogger,
): { url: string; tabId: number } | null => {
    if (!isRecord(payload)) {
        log.debug(`${eventName}: invalid payload`, { payload });
        return null;
    }

    const url = typeof payload['url'] === 'string' ? payload['url'] : undefined;
    const tabId = typeof payload['tabId'] === 'number' ? payload['tabId'] : undefined;

    if (!url) {
        log.debug(`${eventName}: no url provided`, { payload });
        return null;
    }
    if (!tabId) {
        log.debug(`${eventName}: no tabId provided`, { payload });
        return null;
    }

    return { tabId, url };
};

/**
 * Drops a video from the queue, tells every client, then persists — in that order, so a
 * slow disk write never delays the UI. Each step is independent: a failure is logged and
 * the rest still run.
 */
export const removeMusicAndBroadcast = (ctx: ExtensionContext, videoId: string, eventName: string): void => {
    const { emitter, log, repository } = ctx;

    repository.remove(videoId);

    const removedResult = emitter.emitMusicRemoved(videoId);
    if (!removedResult.ok)
        log.warn(`${eventName}: failed to emit musicRemoved`, { error: removedResult.error, videoId });

    const urlListResult = emitter.emitUrlList(repository.buildCompatList());
    if (!urlListResult.ok) log.warn(`${eventName}: failed to emit url_list`, { error: urlListResult.error });

    const persistResult = repository.persistRemove(videoId);
    if (!persistResult.ok) log.warn(`${eventName}: failed to persist removal`, { error: persistResult.error, videoId });
};

/** The add counterpart of removeMusicAndBroadcast. */
export const addMusicAndBroadcast = async (
    ctx: ExtensionContext,
    music: Music,
    eventName: string,
): Promise<void> => {
    const { emitter, log, repository } = ctx;

    repository.add(music);

    const addedResult = emitter.emitMusicAdded(music);
    if (!addedResult.ok)
        log.warn(`${eventName}: failed to emit musicAdded`, { error: addedResult.error, videoId: music.id });

    const urlListResult = emitter.emitUrlList(repository.buildCompatList());
    if (!urlListResult.ok) log.warn(`${eventName}: failed to emit url_list`, { error: urlListResult.error });

    const persistResult = await repository.persistAdd(music);
    if (!persistResult.ok)
        log.warn(`${eventName}: failed to persist`, { error: persistResult.error, videoId: music.id });
};

/** Points the extension's tab at `music` and marks the session as transitioning to it. */
export const navigateToVideo = (
    ctx: ExtensionContext,
    opts: { music: Music; tabId: number; from: string; reason: string; logMessage: string },
): void => {
    const { connectionId, log, manager, socket } = ctx;
    const { music, tabId, from, reason, logMessage } = opts;
    const nextUrl = watchUrl(music.id);

    socket.emit('next_video_navigate', { nextUrl, tabId, videoId: music.id });

    manager.update(
        {
            isTransitioning: true,
            musicId: music.id,
            musicTitle: music.title,
            type: 'paused',
        },
        reason,
    );

    log.info(logMessage, {
        connectionId,
        from,
        nextUrl,
        socketId: socket.id,
        tabId,
        to: music.id,
    });
};

/** Tells the extension the queue is exhausted and parks the session. */
export const reportNoNextVideo = (
    ctx: ExtensionContext,
    opts: { tabId: number; videoId: string; reason: string; logMessage: string },
): void => {
    const { connectionId, log, manager, socket } = ctx;

    socket.emit('no_next_video', { tabId: opts.tabId });
    manager.update({ type: 'closed' }, opts.reason);

    log.info(opts.logMessage, {
        connectionId,
        socketId: socket.id,
        tabId: opts.tabId,
        videoId: opts.videoId,
    });
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
