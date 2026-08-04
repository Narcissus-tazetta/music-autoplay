import { SERVER_ENV } from '@/server/env.server';
import type { RemoteStatus } from '@/shared/types/music';
import { isRecord } from '@/shared/utils/typeGuards';
import { extractYoutubeId } from '@/shared/utils/youtube';
import {
    createEventRegistrar,
    type ExtensionContext,
    isSameVideoOrUnknown,
    type ProgressSnapshot,
    shouldReplaceProgressSnapshot,
} from './extensionHandlerContext';

const AUTHORITATIVE_PLAYING_PROMOTION_MS = 3000;

const pickLatestProgressUpdate = (updates: unknown[]): unknown | null => {
    let best: unknown | null = null;
    let bestTimestamp = -Infinity;
    let bestSeq = -Infinity;

    for (const u of updates) {
        if (!isRecord(u)) continue;
        const ts = typeof u['timestamp'] === 'number' ? u['timestamp'] : -Infinity;
        const seq = typeof u['seq'] === 'number' ? u['seq'] : -Infinity;

        if (ts > bestTimestamp) {
            best = u;
            bestTimestamp = ts;
            bestSeq = seq;
            continue;
        }

        if (ts === bestTimestamp && seq > bestSeq) {
            best = u;
            bestSeq = seq;
        }
    }

    return best;
};

/**
 * `progress_update` / `progress_update_batch` / `video_progress`: the periodic
 * playback position feed, which also drives stall-based advertisement
 * detection and history completion.
 */
export function registerProgressHandlers(ctx: ExtensionContext): void {
    const { history, log, manager, repository, socket, state } = ctx;
    const { authoritativeVideoState, lastProgressSnapshotByVideoId, progressState } = state;
    const on = createEventRegistrar(ctx);

    const scanBatchForHistoryReplayReset = (updates: unknown[]): void => {
        for (const u of updates) {
            if (!isRecord(u)) continue;
            const url = typeof u['url'] === 'string' ? u['url'] : undefined;
            const videoId = url ? extractYoutubeId(url) ?? undefined : undefined;
            const currentTime = typeof u['currentTime'] === 'number' ? u['currentTime'] : undefined;
            const duration = typeof u['duration'] === 'number' ? u['duration'] : undefined;
            history.clearHistoryCompletionIfReplayStarted(
                videoId,
                currentTime,
                duration,
                'progress_update_batch:replay_scan',
            );
        }
    };

    const handleProgressUpdate = async (payload: unknown, eventName: string) => {
        if (!isRecord(payload)) {
            log.debug(`${eventName}: invalid payload`, { payload });
            return;
        }

        const url = typeof payload['url'] === 'string' ? payload['url'] : undefined;
        const currentTime = typeof payload['currentTime'] === 'number'
            ? payload['currentTime']
            : undefined;
        const duration = typeof payload['duration'] === 'number' ? payload['duration'] : undefined;

        if (process.env.NODE_ENV !== 'production')
            console.debug(`[handleProgressUpdate] START`, { url, currentTime, eventName });
        const playbackRate = typeof payload['playbackRate'] === 'number' ? payload['playbackRate'] : 1;
        const isBuffering = typeof payload['isBuffering'] === 'boolean'
            ? payload['isBuffering']
            : false;
        const visibilityState = typeof payload['visibilityState'] === 'string'
            ? payload['visibilityState']
            : 'visible';
        const timestamp = typeof payload['timestamp'] === 'number'
            ? payload['timestamp']
            : Date.now();
        const isAdvertisementFromExtension = typeof payload['isAdvertisement'] === 'boolean'
            ? payload['isAdvertisement']
            : undefined;
        const incomingMusicTitle = typeof payload['musicTitle'] === 'string'
            ? payload['musicTitle']
            : undefined;
        const consecutiveStallsFromExtension = typeof payload['consecutiveStalls'] === 'number'
            ? payload['consecutiveStalls']
            : undefined;
        const clientLatencyMs = typeof payload['clientLatencyMs'] === 'number'
            ? payload['clientLatencyMs']
            : undefined;
        const incomingSeq = typeof payload['seq'] === 'number' ? payload['seq'] : undefined;

        if (
            !url
            || currentTime == undefined
            || duration == undefined
            || !Number.isFinite(currentTime)
            || !Number.isFinite(duration)
        ) {
            log.debug(`${eventName}: invalid data`, {
                currentTime,
                duration,
                url,
            });
            return;
        }

        const videoId = extractYoutubeId(url);

        if (!videoId) {
            log.debug(`${eventName}: invalid YouTube URL`, { url });
            return;
        }

        const incomingSnapshotForOrdering: ProgressSnapshot = {
            timestamp,
            seq: incomingSeq,
            currentTime,
            duration,
        };
        const previousSnapshotForOrdering = lastProgressSnapshotByVideoId.get(videoId);
        if (
            previousSnapshotForOrdering
            && !shouldReplaceProgressSnapshot(previousSnapshotForOrdering, incomingSnapshotForOrdering)
        ) {
            log.debug(`${eventName}: duplicate/stale snapshot ignored`, {
                incomingSeq,
                previousSeq: previousSnapshotForOrdering.seq,
                timestamp,
                previousTimestamp: previousSnapshotForOrdering.timestamp,
                videoId,
            });
            return;
        }

        try {
            let tracking = progressState.get(videoId);
            const isFirstUpdate = !tracking;
            if (!tracking) {
                tracking = {
                    consecutiveStalls: 0,
                    lastAdDecisionAt: 0,
                    lastTime: 0,
                    lastTimestamp: 0,
                };
                progressState.set(videoId, tracking);
            }

            if (!isFirstUpdate && timestamp < tracking.lastTimestamp) {
                log.debug(`${eventName}: out-of-order progress ignored`, {
                    lastTimestamp: tracking.lastTimestamp,
                    timestamp,
                    videoId,
                });
                return;
            }

            const prevTimestamp = tracking.lastTimestamp;
            const prevTime = tracking.lastTime;
            const deltaWall = timestamp - prevTimestamp;
            const deltaPlayback = currentTime - prevTime;
            const backwardDelta = deltaPlayback;
            const seekDetected = Math.abs(backwardDelta) > 5;

            if (!isFirstUpdate && timestamp === prevTimestamp && backwardDelta < 0) {
                log.debug(`${eventName}: regressive progress ignored`, {
                    lastTime: prevTime,
                    currentTime,
                    timestamp,
                    videoId,
                });
                return;
            }

            if (!isFirstUpdate && timestamp > prevTimestamp && backwardDelta < -0.5 && !seekDetected) {
                log.debug(`${eventName}: regressive progress ignored`, {
                    lastTime: prevTime,
                    currentTime,
                    timestamp,
                    videoId,
                });
                return;
            }

            tracking.lastTimestamp = timestamp;
            tracking.lastTime = currentTime;

            const music = repository.get(videoId);
            history.rememberRecordableMusic(music);
            const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

            const stallThreshold = SERVER_ENV.PROGRESS_STALL_THRESHOLD_MS;
            const minDelta = SERVER_ENV.PROGRESS_MIN_DELTA_SEC;
            const stallCount = SERVER_ENV.PROGRESS_STALL_COUNT;
            const cooldown = SERVER_ENV.PROGRESS_COOLDOWN_MS;
            const expectedDelta = (deltaWall / 1000) * playbackRate;

            const currentStatus = manager.getCurrent();
            let isAdvertisement: boolean | undefined = currentStatus.type === 'playing'
                ? currentStatus.isAdvertisement
                : undefined;
            let consecutiveStalls = consecutiveStallsFromExtension !== undefined
                ? consecutiveStallsFromExtension
                : tracking.consecutiveStalls;
            if (isAdvertisementFromExtension !== undefined) isAdvertisement = isAdvertisementFromExtension;
            else if (
                currentStatus.type === 'playing'
                && currentStatus.isAdvertisement === true
            ) {
                isAdvertisement = true;
            }

            if (consecutiveStallsFromExtension === undefined) {
                if (isBuffering || visibilityState === 'hidden') consecutiveStalls = 0;
                else if (isAdvertisement === true) consecutiveStalls = 0;
                else if (deltaWall > stallThreshold) {
                    if (!seekDetected && deltaPlayback < expectedDelta - minDelta) {
                        consecutiveStalls += 1;

                        const cooldownElapsed = timestamp - tracking.lastAdDecisionAt > cooldown;

                        if (consecutiveStalls >= stallCount && cooldownElapsed) {
                            isAdvertisement = true;
                            tracking.lastAdDecisionAt = timestamp;
                            log.info(`${eventName}: advertisement detected`, {
                                consecutiveStalls,
                                deltaPlayback,
                                deltaWall,
                                expectedDelta,
                                videoId,
                            });
                        }
                    } else {
                        consecutiveStalls = 0;
                        if (seekDetected) isAdvertisement = false;
                    }
                }
            }

            tracking.consecutiveStalls = consecutiveStalls;

            const progressSnapshot: ProgressSnapshot = {
                clientLatencyMs,
                consecutiveStalls,
                currentTime,
                duration,
                isAdvertisement,
                isBuffering,
                musicTitle: incomingMusicTitle,
                playbackRate,
                progressPercent,
                seq: incomingSeq,
                timestamp,
            };
            if (shouldReplaceProgressSnapshot(lastProgressSnapshotByVideoId.get(videoId), progressSnapshot))
                lastProgressSnapshotByVideoId.set(videoId, progressSnapshot);

            history.clearHistoryCompletionIfReplayStarted(videoId, currentTime, duration, eventName);

            if (isAdvertisement !== true && history.isCompletionProgress(currentTime, duration))
                history.recordCompletedHistory(videoId, `${eventName}:completion_progress`, music);

            const authoritative = authoritativeVideoState.get(videoId);

            if (visibilityState === 'hidden' && currentStatus.type !== 'playing') {
                log.debug(`${eventName}: hidden progress ignored while non-playing`, {
                    currentStatus: currentStatus.type,
                    videoId,
                });
                return;
            }

            if (currentStatus.type === 'closed') {
                const hasFreshAuthoritativePlaying = authoritative?.state === 'playing'
                    && timestamp - authoritative.receivedAt <= AUTHORITATIVE_PLAYING_PROMOTION_MS
                    && (
                        typeof incomingSeq !== 'number'
                        || typeof authoritative.seq !== 'number'
                        || incomingSeq >= authoritative.seq
                    );

                if (!hasFreshAuthoritativePlaying) {
                    log.debug(`${eventName}: closed->playing promotion blocked (no fresh authoritative playing)`, {
                        authoritativeState: authoritative?.state,
                        authoritativeTs: authoritative?.receivedAt,
                        timestamp,
                        videoId,
                    });
                    return;
                }

                const initialPlaying: RemoteStatus = {
                    type: 'playing',
                    musicTitle: (incomingMusicTitle && incomingMusicTitle.length > 0)
                        ? incomingMusicTitle
                        : (music?.title ?? ''),
                    musicId: videoId,
                    videoId,
                    currentTime,
                    duration,
                    progressPercent,
                    lastProgressUpdate: timestamp,
                    consecutiveStalls,
                    playbackRate,
                    isBuffering,
                    isAdvertisement: isAdvertisement ?? false,
                    isExternalVideo: !music,
                };
                manager.update(initialPlaying, eventName);
                log.debug(`${eventName}: established initial playing from progress`, {
                    isAdvertisement: initialPlaying.isAdvertisement,
                    videoId,
                });
                return;
            }

            if (currentStatus.type !== 'playing') return;
            if (!isSameVideoOrUnknown(currentStatus, videoId)) return;
            if (authoritative?.state === 'paused') return;

            const updated: RemoteStatus = {
                ...currentStatus,
                consecutiveStalls,
                currentTime,
                duration,
                isAdvertisement,
                lastProgressUpdate: timestamp,
                musicId: currentStatus.musicId ?? videoId,
                videoId: currentStatus.videoId ?? videoId,
                musicTitle: (incomingMusicTitle && incomingMusicTitle.length > 0)
                    ? incomingMusicTitle
                    : (currentStatus.musicTitle || music?.title || ''),
                progressPercent,
                playbackRate,
                isBuffering,
                isExternalVideo: currentStatus.isExternalVideo ?? !music,
                type: 'playing',
            };
            manager.update(updated, eventName);

            if (Math.abs(deltaPlayback) > 0.1 || consecutiveStalls > 0 || clientLatencyMs !== undefined) {
                log.debug(`${eventName}: processed`, {
                    clientLatencyMs,
                    consecutiveStalls,
                    currentTime: currentTime.toFixed(2),
                    deltaPlayback: deltaPlayback.toFixed(2),
                    deltaWall,
                    duration: duration.toFixed(2),
                    isAdvertisement,
                    progressPercent: progressPercent.toFixed(1),
                    videoId,
                });
            }
        } catch (error) {
            log.warn(`${eventName}: failed to process`, {
                error: error,
                socketId: socket.id,
                url,
            });
        }
    };

    on('progress_update', payload => handleProgressUpdate(payload, 'progress_update'));

    on('progress_update_batch', payload => {
        if (!isRecord(payload)) return;
        const updates = payload['updates'];
        if (!Array.isArray(updates)) return;
        // Reconnect batches can be large; only process the latest update to avoid transient state churn.
        // Still scan the full batch so replay-start positions clear completion dedupe.
        scanBatchForHistoryReplayReset(updates);
        const latest = pickLatestProgressUpdate(updates);
        if (latest) handleProgressUpdate(latest, 'progress_update_batch');
    });

    on('video_progress', payload => handleProgressUpdate(payload, 'video_progress'));
}
