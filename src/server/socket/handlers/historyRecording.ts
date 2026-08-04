import type { Music } from '@/shared/types/music';
import type { ExtensionContextBase, HistoryRecorder } from './extensionHandlerContext';

const HISTORY_PROGRESS_COMPLETION_REMAINING_SEC = 1;
const HISTORY_REPLAY_RESET_MAX_CURRENT_SEC = 10;
const HISTORY_REPLAY_RESET_MAX_PROGRESS_RATIO = 0.1;

const canRecordHistory = (music: Music): boolean => (
    typeof music.id === 'string'
    && typeof music.title === 'string'
    && typeof music.channelName === 'string'
    && music.id.length > 0
    && music.title.length > 0
    && music.channelName.length > 0
);

/**
 * Records "this video was played to the end" into history, exactly once per
 * video until a replay is observed. `video_ended`, `youtube_video_state:ended`
 * and completion-level progress updates all funnel through here.
 */
export function createHistoryRecorder(ctx: ExtensionContextBase): HistoryRecorder {
    const { emitter, historyService, log, repository, state } = ctx;
    const { historyCompletionRecordedAtByVideoId, recordableMusicSnapshotByVideoId } = state;

    const rememberRecordableMusic = (music: Music | undefined) => {
        if (!music || !canRecordHistory(music)) return;
        recordableMusicSnapshotByVideoId.set(music.id, music);
    };

    const recordHistory = (music: Music | undefined, reason: string): boolean => {
        if (!music) return false;
        if (!canRecordHistory(music)) return false;
        try {
            const historyItem = historyService.recordPlayed(music);
            const emitResult = emitter.emitHistoryAdded(historyItem);
            if (!emitResult.ok) {
                log.warn('historyAdded emit failed', {
                    error: emitResult.error,
                    musicId: music.id,
                    reason,
                });
            }
            return true;
        } catch (error) {
            log.warn('history record failed', {
                error,
                musicId: music.id,
                reason,
            });
            return false;
        }
    };

    const recordCompletedHistory = (
        videoId: string | undefined,
        reason: string,
        musicHint?: Music,
    ): boolean => {
        if (!videoId) return false;

        const now = Date.now();
        const lastRecorded = historyCompletionRecordedAtByVideoId.get(videoId);
        if (lastRecorded) {
            log.debug('history completion duplicate ignored', {
                elapsed: now - lastRecorded,
                reason,
                videoId,
            });
            return false;
        }

        const music = musicHint ?? repository.get(videoId) ?? recordableMusicSnapshotByVideoId.get(videoId);
        if (!music) {
            log.debug('history completion skipped: music snapshot missing', { reason, videoId });
            return false;
        }

        rememberRecordableMusic(music);
        if (!recordHistory(music, reason)) return false;

        historyCompletionRecordedAtByVideoId.set(videoId, now);
        return true;
    };

    const isCompletionProgress = (currentTime: number, duration: number): boolean => (
        duration > 0
        && currentTime >= 0
        && duration - currentTime <= HISTORY_PROGRESS_COMPLETION_REMAINING_SEC
    );

    const clearHistoryCompletionIfReplayStarted = (
        videoId: string | undefined,
        currentTime: number | undefined,
        duration: number | undefined,
        reason: string,
    ): void => {
        if (!videoId || !historyCompletionRecordedAtByVideoId.has(videoId)) return;
        if (
            typeof currentTime !== 'number'
            || typeof duration !== 'number'
            || duration <= 0
            || !Number.isFinite(currentTime)
            || !Number.isFinite(duration)
        ) { return; }

        const progressRatio = currentTime / duration;
        const looksLikeReplay = currentTime <= HISTORY_REPLAY_RESET_MAX_CURRENT_SEC
            || progressRatio <= HISTORY_REPLAY_RESET_MAX_PROGRESS_RATIO;
        if (!looksLikeReplay) return;

        historyCompletionRecordedAtByVideoId.delete(videoId);
        log.debug('history completion reset for replay', {
            currentTime,
            duration,
            progressRatio,
            reason,
            videoId,
        });
    };

    return {
        clearHistoryCompletionIfReplayStarted,
        isCompletionProgress,
        recordCompletedHistory,
        rememberRecordableMusic,
    };
}
