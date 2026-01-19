import type { ChromeMessage, ChromeMessageResponse, ProgressUpdatePayload } from '../types';
const RETRY_CONFIG = { maxRetries: 5, delay: 1000 } as const;
const QUICK_RETRY_CONFIG = { maxRetries: 3, delay: 500 } as const;
const PAGE_CHANGE_DELAY = 100;
const URL_CHECK_INTERVAL = 2000;
const AD_CHECK_INTERVAL = 1500;
const AD_CHECK_INTERVAL_HIDDEN = 1500;
const VIDEO_CHECK_INTERVAL = 1000;
const VIDEO_CHECK_INTERVAL_HIDDEN = 1000;
const SEND_PROGRESS_INTERVAL_MS = 1000;
const PROGRESS_SEND_MIN_DELTA_SEC = 2;
const VIDEO_END_THRESHOLD = 0.5;
const NEAR_END_THRESHOLD = 4;

let reloadScheduledForInvalidatedContext = false;

function hasRuntimeSendMessage(): boolean {
    try {
        return typeof (globalThis as any)?.chrome?.runtime?.sendMessage === 'function';
    } catch {
        return false;
    }
}

function isExtensionContextInvalidatedError(err: unknown): boolean {
    if (!err) return false;
    const message = err instanceof Error ? err.message : String(err);
    return message.includes('Extension context invalidated');
}

function maybeRecoverFromInvalidatedContext(): void {
    if (reloadScheduledForInvalidatedContext) return;
    if (!isExtensionOpenedTab()) return;

    reloadScheduledForInvalidatedContext = true;
    try {
        setTimeout(() => {
            try {
                location.reload();
            } catch {
                // ignore
            }
        }, 1000);
    } catch {
        // ignore
    }
}

const isContentDebugEnabled = (): boolean => {
    try {
        return window.sessionStorage.getItem('yt_content_debug') === '1';
    } catch {
        return false;
    }
};

const debugLog = (...args: unknown[]): void => {
    if (!isContentDebugEnabled()) return;
    console.debug(...args);
};

function isPlaylistUrl(url: string): boolean {
    try {
        return new URL(url).searchParams.has('list');
    } catch {
        return false;
    }
}

interface VideoElement extends HTMLVideoElement {
    dataset: DOMStringMap & { hasStateListener?: string };
}

enum VideoState {
    PLAYING = 'playing',
    PAUSED = 'paused',
    ENDED = 'ended',
    SEEKING = 'seeking',
    WAITING = 'waiting',
}

export class AdDetector {
    private observer: MutationObserver | null = null;
    private isAdCurrently: boolean = false;
    private adCheckInterval: number | null = null;
    private player: Element | null = null;
    private videoState: VideoState = VideoState.PAUSED;
    private videoElement: HTMLVideoElement | null = null;
    private videoCheckInterval: number | null = null;
    private heartbeatInterval: number | null = null;
    private batchInterval: number | null = null;
    private isContextInvalidated: boolean = false;
    private lastProgressSentTs: number = 0;
    private lastSentCurrentTime: number = 0;
    private lastState: VideoState = VideoState.PAUSED;
    private lastIsAd: boolean = false;
    private lastBufferingState: boolean = false;
    private isInForeground: boolean = true;
    private progressBuffer: ProgressUpdatePayload[] = [];
    private consecutiveStalls: number = 0;
    private imminentEndSent: boolean = false;
    private videoEndSent: boolean = false;
    private lastVideoId: string = '';
    private readonly seqByVideoId = new Map<string, number>();
    private readonly validTransitions: Record<VideoState, VideoState[]> = {
        [VideoState.PLAYING]: [VideoState.PAUSED, VideoState.SEEKING, VideoState.WAITING, VideoState.ENDED],
        [VideoState.PAUSED]: [VideoState.PLAYING, VideoState.SEEKING, VideoState.ENDED],
        [VideoState.SEEKING]: [VideoState.PLAYING, VideoState.PAUSED, VideoState.WAITING, VideoState.ENDED],
        [VideoState.WAITING]: [VideoState.PLAYING, VideoState.PAUSED, VideoState.SEEKING, VideoState.ENDED],
        [VideoState.ENDED]: [VideoState.PLAYING, VideoState.PAUSED],
    };

    start(): void {
        this.setupObserver();
        this.setupVisibilityHandler();
        this.setIntervals();
        this.setupHeartbeat();
    }

    private setupVisibilityHandler(): void {
        document.addEventListener('visibilitychange', () => {
            const wasInForeground = this.isInForeground;
            this.isInForeground = !document.hidden;
            if (wasInForeground === this.isInForeground) return;
            this.setIntervals();
        });
    }

    private setIntervals(): void {
        if (this.videoCheckInterval !== null) {
            clearInterval(this.videoCheckInterval);
            this.videoCheckInterval = null;
        }
        if (this.adCheckInterval !== null) {
            clearInterval(this.adCheckInterval);
            this.adCheckInterval = null;
        }

        const videoInterval = this.isInForeground ? VIDEO_CHECK_INTERVAL : VIDEO_CHECK_INTERVAL_HIDDEN;
        const adInterval = this.isInForeground ? AD_CHECK_INTERVAL : AD_CHECK_INTERVAL_HIDDEN;

        this.videoCheckInterval = window.setInterval(
            () => this.checkVideoAndSendProgress(),
            videoInterval,
        );
        this.adCheckInterval = window.setInterval(
            () => this.checkAndNotifyAdState(),
            adInterval,
        );
    }

    private setupHeartbeat(): void {
        this.heartbeatInterval = window.setInterval(() => {
            if (document.hidden && this.videoElement) {
                try {
                    if (!hasRuntimeSendMessage()) {
                        this.handleInvalidatedContext();
                        return;
                    }
                    const { currentTime, duration } = this.videoElement;
                    if (this.isValidTimeValue(currentTime) && this.isValidTimeValue(duration)) {
                        const url = location.href;
                        const videoId = extractYouTubeIdFromUrl(url);
                        chrome.runtime.sendMessage({
                            type: 'progress_update',
                            url,
                            videoId,
                            currentTime,
                            duration,
                            playbackRate: this.videoElement?.playbackRate || 1,
                            isBuffering: (this.videoElement?.readyState ?? 0) < 3,
                            visibilityState: document.visibilityState,
                            timestamp: Date.now(),
                            isAdvertisement: this.isAdCurrently,
                            musicTitle: getYouTubeVideoInfo()?.title,
                            progressPercent: Number(((currentTime / duration) * 100).toFixed(2)),
                            consecutiveStalls: this.consecutiveStalls,
                            seq: videoId ? this.getSeq(videoId) : undefined,
                            openedByExtension: isExtensionOpenedTab(),
                        });
                    }
                } catch (error) {
                    if (isExtensionContextInvalidatedError(error)) {
                        this.handleInvalidatedContext();
                        return;
                    }
                    console.warn('[AdDetector] Failed to send heartbeat', error);
                }
            }
        }, 30000);

        this.batchInterval = window.setInterval(() => {
            if (this.progressBuffer.length > 0) {
                const bufferedUpdates = this.progressBuffer.splice(0);
                try {
                    if (!hasRuntimeSendMessage()) {
                        this.progressBuffer.unshift(...bufferedUpdates);
                        this.handleInvalidatedContext();
                        return;
                    }
                    chrome.runtime.sendMessage({
                        type: 'batch_progress_update' as const,
                        updates: bufferedUpdates,
                    });
                } catch (error) {
                    if (isExtensionContextInvalidatedError(error)) {
                        this.handleInvalidatedContext();
                        return;
                    }
                    console.warn('[AdDetector] Failed to send batched progress', error);
                    this.progressBuffer.unshift(...bufferedUpdates);
                }
            }
        }, 100);
    }

    private handleInvalidatedContext(): void {
        if (this.isContextInvalidated) return;
        this.isContextInvalidated = true;
        try {
            this.stop();
        } catch {
            // ignore
        }
        maybeRecoverFromInvalidatedContext();
    }

    private addToProgressBuffer(payload: ProgressUpdatePayload): void {
        this.progressBuffer.push(payload);
    }

    private transitionState(newState: VideoState): boolean {
        const validNextStates = this.validTransitions[this.videoState];
        if (!validNextStates.includes(newState)) {
            console.warn('[AdDetector] Invalid state transition', {
                current: this.videoState,
                attempted: newState,
                validTransitions: validNextStates,
            });
            return false;
        }
        this.videoState = newState;
        return true;
    }

    private setVideoState(newState: VideoState): void {
        if (newState !== this.videoState) this.transitionState(newState);
    }

    setVideoElement(video: HTMLVideoElement): void {
        this.videoElement = video;
    }

    private checkVideoAndSendProgress(): void {
        if (!this.videoElement) return;

        const { currentTime, duration } = this.videoElement;
        if (!this.isValidTimeValue(currentTime) || !this.isValidTimeValue(duration)) return;

        const videoId = extractYouTubeIdFromUrl(location.href) ?? '';
        if (videoId !== this.lastVideoId) {
            this.lastVideoId = videoId;
            this.imminentEndSent = false;
            this.videoEndSent = false;
            if (videoId && !this.seqByVideoId.has(videoId)) this.seqByVideoId.set(videoId, 0);
        }

        const remaining = duration - currentTime;
        const isConfirmed = remaining <= 0.05 || this.videoElement.ended;

        if (!this.videoEndSent && isConfirmed && !this.isAdCurrently) {
            this.videoEndSent = true;
            try {
                chrome.runtime.sendMessage({
                    type: 'video_ended',
                    url: location.href,
                    tabId: undefined,
                });
            } catch (error) {
                console.warn('[AdDetector] video_ended send failed:', error);
            }
        }

        let targetState = this.videoState;

        if (this.videoElement.paused) targetState = VideoState.PAUSED;
        else if (this.videoElement.seeking) targetState = VideoState.SEEKING;
        else if ((this.videoElement.readyState ?? 0) < 3) targetState = VideoState.WAITING;
        else if (this.isVideoEnded(currentTime, duration)) targetState = VideoState.ENDED;
        else targetState = VideoState.PLAYING;

        if (targetState !== this.videoState) this.setVideoState(targetState);

        const now = Date.now();
        const elapsed = now - this.lastProgressSentTs;
        const delta = Math.abs(currentTime - this.lastSentCurrentTime);
        const buffering = (this.videoElement?.readyState ?? 0) < 3;
        const stateChanged = this.videoState !== this.lastState;
        const adChanged = this.isAdCurrently !== this.lastIsAd;
        const bufferingChanged = buffering !== this.lastBufferingState;
        const nearEnd = this.isNearVideoEnd();

        if (targetState === VideoState.PLAYING && !buffering) {
            const progress = currentTime - this.lastSentCurrentTime;
            if (progress < 0.01 && elapsed >= SEND_PROGRESS_INTERVAL_MS) this.consecutiveStalls++;
            else if (progress >= 0.5) this.consecutiveStalls = 0;
        } else {
            this.consecutiveStalls = 0;
        }

        const shouldSend = elapsed >= SEND_PROGRESS_INTERVAL_MS
            || delta >= PROGRESS_SEND_MIN_DELTA_SEC
            || stateChanged
            || adChanged
            || bufferingChanged
            || nearEnd;

        if (shouldSend) {
            const remaining = duration - currentTime;
            const isImminent = remaining <= 0.5 && remaining > 0.05;

            const url = location.href;
            const videoId = extractYouTubeIdFromUrl(url) ?? '';

            this.addToProgressBuffer({
                consecutiveStalls: this.consecutiveStalls,
                currentTime,
                duration,
                imminentEnd: isImminent || undefined,
                isAdvertisement: this.isAdCurrently,
                isBuffering: buffering,
                musicTitle: getYouTubeVideoInfo()?.title,
                playbackRate: this.videoElement?.playbackRate || 1,
                progressPercent: Number(((currentTime / duration) * 100).toFixed(2)),
                timestamp: now,
                type: 'progress_update',
                url,
                videoId: videoId || undefined,
                seq: videoId ? this.getSeq(videoId) : undefined,
                openedByExtension: isExtensionOpenedTab(),
                visibilityState: document.visibilityState,
            });

            this.lastProgressSentTs = now;
            this.lastSentCurrentTime = currentTime;
            this.lastState = this.videoState;
            this.lastIsAd = this.isAdCurrently;
            this.lastBufferingState = buffering;
        }
    }

    private isValidTimeValue(time: number): boolean {
        return !isNaN(time) && isFinite(time) && time > 0;
    }

    private isVideoEnded(currentTime: number, duration: number): boolean {
        return currentTime >= duration - VIDEO_END_THRESHOLD || currentTime >= duration;
    }

    private isNearVideoEnd(): boolean {
        if (!this.videoElement) return false;

        const { currentTime, duration } = this.videoElement;

        if (!this.isValidTimeValue(duration) || !this.isValidTimeValue(currentTime)) return false;

        return duration - currentTime <= NEAR_END_THRESHOLD;
    }

    markMainVideoEnded(): void {
        this.setVideoState(VideoState.ENDED);
    }

    markProgressSent(now: number): void {
        this.lastProgressSentTs = now;
    }

    resetToPlaying(): void {
        this.setVideoState(VideoState.PLAYING);
    }

    private setupObserver(): void {
        this.player = document.querySelector('.html5-video-player');
        if (!this.player) {
            setTimeout(() => this.setupObserver(), 1000);
            return;
        }

        this.observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.checkAndNotifyAdState();
                    break;
                }
            }
        });
        this.observer.observe(this.player, {
            attributes: true,
            attributeFilter: ['class'],
            attributeOldValue: false,
            characterData: false,
            childList: false,
            subtree: false,
        });
        setTimeout(() => this.checkAndNotifyAdState(), 0);
    }

    private checkAndNotifyAdState(): void {
        const wasAd = this.isAdCurrently;
        const nearEnd = this.isNearVideoEnd();
        this.isAdCurrently = this.checkIfAd();

        if (wasAd !== this.isAdCurrently) {
            console.log(
                `[AdDetector] ${wasAd ? '広告' : '本編'} → ${this.isAdCurrently ? '🔴広告' : '▶️本編'}`,
                { wasAd, isAd: this.isAdCurrently, videoState: this.videoState, nearEnd },
            );
            this.notifyAdState();

            if (!wasAd && this.isAdCurrently) {
                if (
                    this.videoState === VideoState.ENDED
                    || this.videoState === VideoState.WAITING
                    || nearEnd
                ) {
                    this.setVideoState(VideoState.WAITING);
                    this.skipToNextVideo();
                }
            } else if (wasAd && !this.isAdCurrently) {
                if (this.videoState === VideoState.WAITING) this.setVideoState(VideoState.ENDED);
                const isExtensionControlled = isExtensionNavigating() || isExtensionOpenedTab();
                if (isExtensionControlled) {
                    disableYouTubeAutoplay();
                    setTimeout(() => disableYouTubeAutoplay(), 100);
                    setTimeout(() => disableYouTubeAutoplay(), 500);
                }
                const currentTime = this.videoElement?.currentTime ?? 0;
                const duration = this.videoElement?.duration ?? 0;
                if (!this.videoEndSent && duration > 0 && (duration - currentTime) < 5) {
                    this.videoEndSent = true;
                    try {
                        chrome.runtime.sendMessage({
                            type: 'youtube_video_state',
                            url: location.href,
                            state: 'ended',
                            currentTime,
                            duration,
                            timestamp: Date.now(),
                            isAdvertisement: false,
                        });
                    } catch (error) {
                        console.warn('[AdDetector] youtube_video_state ended send failed after ad:', error);
                    }
                }
            }
        }
    }

    private checkIfAd(): boolean {
        if (!this.player) this.player = document.querySelector('.html5-video-player');

        const hasAdClass = this.player?.classList.contains('ad-showing')
            || this.player?.classList.contains('ad-interrupting');

        if (hasAdClass) return true;

        const hasAdElement = !!(
            document.querySelector('.ytp-ad-player-overlay')
            || document.querySelector('.ytp-ad-text')
            || document.querySelector('.ytp-ad-skip-button-container')
        );

        return hasAdElement;
    }

    private notifyAdState(): void {
        const payload = {
            type: 'ad_state_changed' as const,
            isAd: this.isAdCurrently,
            url: location.href,
            videoId: extractYouTubeIdFromUrl(location.href) ?? undefined,
            timestamp: Date.now(),
        };

        try {
            chrome.runtime.sendMessage(payload);
        } catch (error) {
            console.warn('[AdDetector] 送信失敗:', error);
        }
    }

    private skipToNextVideo(): void {
        if (isPlaylistUrl(location.href)) return;

        try {
            const currentTime = this.videoElement?.currentTime ?? null;
            const duration = this.videoElement?.duration ?? null;
            debugLog('[AdDetector] Skipping to next video', {
                videoState: this.videoState,
                currentTime: currentTime !== null ? currentTime.toFixed(2) : null,
                duration: duration !== null ? duration.toFixed(2) : null,
                url: location.href,
            });
            chrome.runtime.sendMessage({
                type: 'ad_skip_to_next',
                url: location.href,
            });
        } catch (error) {
            console.warn('[AdDetector] Failed to send skip message', error);
        }
    }

    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.adCheckInterval !== null) {
            clearInterval(this.adCheckInterval);
            this.adCheckInterval = null;
        }

        if (this.videoCheckInterval !== null) {
            clearInterval(this.videoCheckInterval);
            this.videoCheckInterval = null;
        }

        if (this.heartbeatInterval !== null) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.batchInterval !== null) {
            clearInterval(this.batchInterval);
            this.batchInterval = null;
        }

        this.player = null;
        this.videoElement = null;
        this.lastProgressSentTs = 0;
        this.progressBuffer = [];
    }

    getCurrentAdState(): boolean {
        return this.isAdCurrently;
    }

    getSeq(videoId: string): number {
        return this.seqByVideoId.get(videoId) ?? 0;
    }

    bumpSeq(videoId: string): number {
        const next = this.getSeq(videoId) + 1;
        this.seqByVideoId.set(videoId, next);
        return next;
    }
}

class VideoTransitionTracker {
    private isTransitioning: boolean = false;
    private transitionTimer: number | null = null;
    private readonly TRANSITION_TIMEOUT = 1000;

    onVideoEnded(isAdPlaying: boolean): void {
        if (isAdPlaying) return;

        this.isTransitioning = true;
        if (this.transitionTimer) clearTimeout(this.transitionTimer);
        this.transitionTimer = window.setTimeout(() => {
            this.isTransitioning = false;
        }, this.TRANSITION_TIMEOUT);
    }

    onVideoPlaying(): void {
        if (this.isTransitioning) {
            this.isTransitioning = false;
            if (this.transitionTimer) {
                clearTimeout(this.transitionTimer);
                this.transitionTimer = null;
            }
        }
    }

    shouldIgnorePause(isAdPlaying: boolean): boolean {
        if (isAdPlaying) return false;
        return this.isTransitioning;
    }
}

function getYouTubeVideoInfo(): { url: string; title: string } | null {
    try {
        const url = location.href;
        if (!url.includes('youtube.com/watch')) return null;

        const titleElement = document.querySelector(
            '#title > h1 > yt-formatted-string, .title.style-scope.ytd-video-primary-info-renderer, ytd-watch-metadata h1 yt-formatted-string',
        );
        const title = titleElement?.textContent?.trim() || '';

        if (!title) return null;

        return { url, title };
    } catch {
        return null;
    }
}
function extractYouTubeIdFromUrl(url: string): string | null {
    try {
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v && v.length > 0) return v;
        const short = url.match(/^https?:\/\/youtu\.be\/([\w-]{11})/);
        return short?.[1] ?? null;
    } catch {
        return null;
    }
}

const adDetector = new AdDetector();
const transitionTracker = new VideoTransitionTracker();

function disableYouTubeAutoplay(): void {
    try {
        const autoplayButton = document.querySelector(
            '.ytp-button[data-tooltip-target-id="ytp-autonav-toggle-button"]',
        ) as HTMLElement;

        if (autoplayButton) {
            const isAutoplayOn = autoplayButton.getAttribute('aria-checked') === 'true';
            if (isAutoplayOn) autoplayButton.click();
        }
    } catch {
        // autoplayボタンが見つからない場合は無視
    }
}

function detectPageChange(): void {
    if (location.href.includes('youtube.com/watch')) {
        const isExtensionControlled = isExtensionNavigating() || isExtensionOpenedTab();
        if (isExtensionControlled) {
            disableYouTubeAutoplay();
            setTimeout(() => disableYouTubeAutoplay(), 100);
            setTimeout(() => disableYouTubeAutoplay(), 500);
            setTimeout(() => disableYouTubeAutoplay(), 1000);
            setTimeout(() => disableYouTubeAutoplay(), 2000);
            setTimeout(() => {
                disableYouTubeAutoplay();
                if (isExtensionNavigating()) clearExtensionNavigatingFlag();
            }, 3000);
        }
        attachVideoListeners();
    }
}

function findVideoElement(root: Document | ShadowRoot = document): HTMLVideoElement | null {
    const prioritySelectors = [
        'video.html5-main-video',
        '#movie_player video',
        'ytd-player video',
        'div#player video',
        'video',
    ];

    for (const selector of prioritySelectors) {
        const el = root.querySelector(selector) as HTMLVideoElement | null;
        if (el) return el;
    }

    const shadowHosts = Array.from(root.querySelectorAll('ytd-player, ytd-watch-flexy, #movie_player'));
    for (const host of shadowHosts) {
        const shadow = (host as Element & { shadowRoot?: ShadowRoot }).shadowRoot;
        if (shadow) {
            const shadowVideo = findVideoElement(shadow);
            if (shadowVideo) return shadowVideo;
        }
    }

    const iframes = Array.from(root.querySelectorAll('iframe'));
    for (const iframe of iframes) {
        try {
            if (iframe.contentDocument) {
                const iframeVideo = findVideoElement(iframe.contentDocument);
                if (iframeVideo) return iframeVideo;
            }
        } catch {
            continue;
        }
    }

    const allElements = Array.from(root.querySelectorAll('*'));
    for (const el of allElements) {
        const shadowRoot = (el as Element & { shadowRoot?: ShadowRoot }).shadowRoot;
        if (shadowRoot) {
            const shadowVideo = findVideoElement(shadowRoot);
            if (shadowVideo) return shadowVideo;
        }
    }

    return null;
}

async function getVideoWithRetry(
    maxRetries: number = RETRY_CONFIG.maxRetries,
    delay: number = RETRY_CONFIG.delay,
): Promise<HTMLVideoElement | null> {
    const attempt = async (i: number): Promise<HTMLVideoElement | null> => {
        const video = findVideoElement();
        if (video) return video;
        if (i >= maxRetries - 1) return null;
        await new Promise(resolve => setTimeout(resolve, delay));
        return attempt(i + 1);
    };
    return attempt(0);
}

function attachVideoListeners(): void {
    getVideoWithRetry(QUICK_RETRY_CONFIG.maxRetries, QUICK_RETRY_CONFIG.delay).then(video => {
        if (!video) return;

        const videoEl = video as VideoElement;
        if (videoEl.dataset.hasStateListener) return;
        videoEl.dataset.hasStateListener = 'true';
        adDetector.setVideoElement(video);

        const notifyState = (state: string) => {
            try {
                const currentTime = video.currentTime ?? null;
                const duration = video.duration ?? null;
                const isAd = adDetector.getCurrentAdState();
                const url = location.href;
                const videoId = extractYouTubeIdFromUrl(url) ?? '';
                const seq = videoId ? adDetector.bumpSeq(videoId) : undefined;
                debugLog('[Content] notifyState', { state, currentTime, duration });
                chrome.runtime.sendMessage({
                    type: 'youtube_video_state',
                    url,
                    state,
                    currentTime,
                    duration,
                    timestamp: Date.now(),
                    isAdvertisement: isAd,
                    videoId: videoId || undefined,
                    seq,
                    openedByExtension: isExtensionOpenedTab(),
                });
                if (state === 'ended') chrome.storage.local.set({ latestUrl: 'ended' });
            } catch {
                return;
            }
        };

        const handleSignificantEvent = (_eventName: string) => {
            try {
                const currentTime = video.currentTime ?? null;
                const duration = video.duration ?? null;
                if (currentTime !== null && duration !== null && !isNaN(currentTime) && !isNaN(duration)) {
                    const url = location.href;
                    const videoId = extractYouTubeIdFromUrl(url) ?? '';
                    const payload: ProgressUpdatePayload = {
                        type: 'progress_update',
                        url,
                        videoId: videoId || undefined,
                        currentTime,
                        duration,
                        playbackRate: video.playbackRate || 1,
                        isBuffering: (video.readyState ?? 0) < 3,
                        visibilityState: document.visibilityState,
                        timestamp: Date.now(),
                        isAdvertisement: adDetector.getCurrentAdState(),
                        musicTitle: getYouTubeVideoInfo()?.title,
                        progressPercent: Number(((currentTime / duration) * 100).toFixed(2)),
                        seq: videoId ? adDetector.getSeq(videoId) : undefined,
                        openedByExtension: isExtensionOpenedTab(),
                    };
                    adDetector['addToProgressBuffer'](payload);
                }
            } catch (error) {
                console.warn('[Content] Failed to handle significant event', error);
            }
        };

        // Emit an initial snapshot. For non-extension-opened tabs, background may ignore
        // youtube_video_state until it has seen at least one progress_update (which marks
        // the tab as active playback). So we send progress first and delay the state.
        handleSignificantEvent('init');
        const initialState = video.paused ? 'paused' : 'playing';
        if (isExtensionOpenedTab()) notifyState(initialState);
        else window.setTimeout(() => notifyState(initialState), 200);

        video.addEventListener('ended', () => {
            const isAdPlaying = adDetector.getCurrentAdState();

            adDetector.markMainVideoEnded();

            debugLog('[Content] video ended event', {
                isAdPlaying,
                videoState: adDetector.getCurrentAdState(),
                currentTime: video.currentTime,
                duration: video.duration,
            });

            disableYouTubeAutoplay();
            setTimeout(() => disableYouTubeAutoplay(), 100);
            setTimeout(() => disableYouTubeAutoplay(), 500);
            setTimeout(() => disableYouTubeAutoplay(), 1000);

            if (isAdPlaying) return;

            transitionTracker.onVideoEnded(isAdPlaying);
            notifyState('ended');
            handleSignificantEvent('ended');
        });

        video.addEventListener('play', () => {
            adDetector.resetToPlaying();
            transitionTracker.onVideoPlaying();
            debugLog('[Content] video play event', {
                currentTime: video.currentTime,
                duration: video.duration,
            });
            notifyState('playing');
            handleSignificantEvent('play');
        });

        video.addEventListener('pause', () => {
            const isAdPlaying = adDetector.getCurrentAdState();
            debugLog('[Content] video pause event', { isAdPlaying, currentTime: video.currentTime });
            if (transitionTracker.shouldIgnorePause(isAdPlaying)) return;
            notifyState('paused');
            handleSignificantEvent('pause');
        });

        video.addEventListener('seeking', () => {
            handleSignificantEvent('seeking');
        });

        video.addEventListener('seeked', () => {
            handleSignificantEvent('seeked');
        });

        video.addEventListener('ratechange', () => {
            handleSignificantEvent('ratechange');
        });

        video.addEventListener('waiting', () => {
            handleSignificantEvent('waiting');
        });

        if (video.ended) notifyState('ended');
        else if (video.paused) notifyState('paused');
        else notifyState('playing');
    });
}

function isExtensionOpenedTab(): boolean {
    try {
        const opened = window.sessionStorage.getItem('opened_by_extension') === '1';
        const navigating = window.sessionStorage.getItem('extension_navigating') === '1';
        return opened || navigating;
    } catch {
        return false;
    }
}

function isExtensionNavigating(): boolean {
    try {
        return window.sessionStorage.getItem('extension_navigating') === '1';
    } catch {
        return false;
    }
}

function clearExtensionNavigatingFlag(): void {
    try {
        window.sessionStorage.removeItem('extension_navigating');
    } catch {
        return;
    }
}

async function handleVideoControl(
    message: ChromeMessage,
    sendResponse: (response: ChromeMessageResponse) => void,
): Promise<void> {
    const video = await getVideoWithRetry(QUICK_RETRY_CONFIG.maxRetries, QUICK_RETRY_CONFIG.delay);

    if (!video) {
        sendResponse({ status: 'no_video' });
        return;
    }

    try {
        switch (message.type) {
            case 'yt_play':
                await video.play().catch(err => {
                    throw new Error(`Play failed: ${err.message}`);
                });
                break;
            case 'yt_pause':
            case 'pause_video':
                video.pause();
                break;
            case 'toggle_play_pause':
                if (video.paused) {
                    await video.play().catch(err => {
                        throw new Error(`Play failed: ${err.message}`);
                    });
                } else {
                    video.pause();
                }
                break;
        }
        sendResponse({ status: 'ok' });
    } catch (error) {
        sendResponse({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

async function handleGetVideoState(
    sendResponse: (response: ChromeMessageResponse) => void,
): Promise<void> {
    if (!isExtensionOpenedTab()) {
        sendResponse({ status: 'not_extension_tab' } as never);
        return;
    }

    const video = await getVideoWithRetry(QUICK_RETRY_CONFIG.maxRetries, QUICK_RETRY_CONFIG.delay);
    sendResponse({
        status: 'ok',
        state: video ? (video.paused ? 'paused' : 'playing') : 'no_video',
    } as never);
}
async function handleWaitForEnd(): Promise<void> {
    if (!isExtensionOpenedTab()) return;

    const video = await getVideoWithRetry(QUICK_RETRY_CONFIG.maxRetries, QUICK_RETRY_CONFIG.delay);
    if (!video) return;

    const handler = () => {
        try {
            const currentTime = video.currentTime ?? 0;
            const duration = video.duration ?? 0;
            chrome.runtime.sendMessage({
                type: 'youtube_video_state',
                url: location.href,
                state: 'ended',
                currentTime,
                duration,
                timestamp: Date.now(),
                isAdvertisement: false,
            }, () => {
                if (chrome.runtime.lastError) return;
            });
        } catch {
            return;
        }
        video.removeEventListener('ended', handler);
    };

    video.addEventListener('ended', handler);
}

async function handleForcePause(): Promise<void> {
    const video = await getVideoWithRetry(QUICK_RETRY_CONFIG.maxRetries, QUICK_RETRY_CONFIG.delay);
    if (video && !video.paused) video.pause();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { type } = message;

    if (
        type === 'yt_play'
        || type === 'yt_pause'
        || type === 'pause_video'
        || type === 'toggle_play_pause'
    ) {
        handleVideoControl(message, sendResponse);
        return true;
    }

    if (message.type === 'get_current_url') {
        sendResponse({ status: 'ok', url: location.href });
        return false;
    }

    if (type === 'get_video_state') {
        handleGetVideoState(sendResponse);
        return true;
    }

    if (type === 'wait_for_end') {
        handleWaitForEnd();
        return false;
    }

    if (type === 'mark_extension_opened') {
        try {
            window.sessionStorage.setItem('opened_by_extension', '1');
            sendResponse({ status: 'ok' });
        } catch {
            sendResponse({ status: 'error' });
        }
        return false;
    }

    if (type === 'mark_extension_navigating') {
        try {
            window.sessionStorage.setItem('opened_by_extension', '1');
            window.sessionStorage.setItem('extension_navigating', '1');
            sendResponse({ status: 'ok' });
        } catch {
            sendResponse({ status: 'error' });
        }
        return false;
    }

    if (type === 'force_pause') {
        handleForcePause();
        return false;
    }

    if (type === 'get_video_info') {
        const info = getYouTubeVideoInfo();
        if (info) sendResponse({ status: 'ok', url: info.url, title: info.title } as never);
        else sendResponse({ status: 'error', error: 'Could not get video info' } as never);
        return false;
    }
    if (type === 'get_ad_state') {
        sendResponse({
            status: 'ok',
            isAd: adDetector.getCurrentAdState(),
        } as never);
        return false;
    }

    return false;
});

interface WindowWithInjection extends Window {
    _ytContentScriptInjected?: boolean;
}

const windowWithFlag = typeof window !== 'undefined' ? (window as WindowWithInjection) : undefined;

if (windowWithFlag && !windowWithFlag._ytContentScriptInjected) {
    windowWithFlag._ytContentScriptInjected = true;

    const originalPushState = history.pushState;
    history.pushState = function(data: unknown, unused: string, url?: string | URL | null): void {
        originalPushState.call(this, data, unused, url);
        setTimeout(detectPageChange, PAGE_CHANGE_DELAY);
    };

    window.addEventListener('popstate', () => setTimeout(detectPageChange, PAGE_CHANGE_DELAY));

    let lastHref = location.href;
    setInterval(() => {
        if (document.hidden) return;
        if (location.href !== lastHref) {
            lastHref = location.href;
            detectPageChange();
        }
    }, URL_CHECK_INTERVAL);

    detectPageChange();
    adDetector.start();
}
