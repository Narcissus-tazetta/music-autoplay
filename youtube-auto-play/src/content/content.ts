import type { ChromeMessage, ChromeMessageResponse, ProgressUpdatePayload } from '../types';
const RETRY_CONFIG = { maxRetries: 5, delay: 1000 } as const;
const QUICK_RETRY_CONFIG = { maxRetries: 3, delay: 500 } as const;
const PAGE_CHANGE_DELAY = 100;
const URL_CHECK_INTERVAL = 500;
const AD_CHECK_INTERVAL = 1500;
const VIDEO_CHECK_INTERVAL = 1000;
const SEND_PROGRESS_INTERVAL_MS = 1000;
const VIDEO_END_THRESHOLD = 0.5;
const NEAR_END_THRESHOLD = 4;

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
    ENDED = 'ended',
    WAITING_FOR_NEXT = 'waiting_for_next',
}

class AdDetector {
    private observer: MutationObserver | null = null;
    private isAdCurrently: boolean = false;
    private adCheckInterval: number | null = null;
    private player: Element | null = null;
    private videoState: VideoState = VideoState.PLAYING;
    private videoElement: HTMLVideoElement | null = null;
    private videoCheckInterval: number | null = null;
    private lastProgressSentTs: number = 0;

    start(): void {
        this.setupObserver();
        this.adCheckInterval = window.setInterval(
            () => this.checkAndNotifyAdState(),
            AD_CHECK_INTERVAL,
        );
        this.videoCheckInterval = window.setInterval(
            () => this.checkVideoAndSendProgress(),
            VIDEO_CHECK_INTERVAL,
        );
    }

    setVideoElement(video: HTMLVideoElement): void {
        this.videoElement = video;
    }

    private checkVideoAndSendProgress(): void {
        if (!this.videoElement) return;

        const { currentTime, duration } = this.videoElement;
        if (!this.isValidTimeValue(currentTime) || !this.isValidTimeValue(duration)) return;

        if (this.videoState === VideoState.PLAYING && this.isVideoEnded(currentTime, duration)) {
            this.videoState = VideoState.ENDED;
            console.debug('[AdDetector] Video reached end: setting videoState=ENDED', {
                currentTime: currentTime.toFixed(2),
                duration: duration.toFixed(2),
                remainingTime: (duration - currentTime).toFixed(2),
            });
        }

        const now = Date.now();
        if (now - this.lastProgressSentTs >= SEND_PROGRESS_INTERVAL_MS) {
            try {
                chrome.runtime.sendMessage({
                    type: 'progress_update',
                    url: location.href,
                    videoId: extractYouTubeIdFromUrl(location.href),
                    currentTime,
                    duration,
                    playbackRate: this.videoElement?.playbackRate || 1,
                    isBuffering: (this.videoElement?.readyState ?? 0) < 3,
                    visibilityState: document.visibilityState,
                    timestamp: now,
                    isAdvertisement: this.isAdCurrently,
                    musicTitle: getYouTubeVideoInfo()?.title,
                    progressPercent: Number(((currentTime / duration) * 100).toFixed(2)),
                });
                this.lastProgressSentTs = now;
            } catch (error) {
                console.warn('[AdDetector] Failed to send progress', error);
            }
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
        this.videoState = VideoState.ENDED;
    }

    markProgressSent(now: number): void {
        this.lastProgressSentTs = now;
    }

    resetToPlaying(): void {
        this.videoState = VideoState.PLAYING;
    }

    private setupObserver(): void {
        this.player = document.querySelector('.html5-video-player');
        if (!this.player) {
            setTimeout(() => this.setupObserver(), 1000);
            return;
        }

        this.observer = new MutationObserver(() => this.checkAndNotifyAdState());
        this.observer.observe(this.player, {
            attributes: true,
            attributeFilter: ['class'],
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
                    || this.videoState === VideoState.WAITING_FOR_NEXT
                    || nearEnd
                ) {
                    this.videoState = VideoState.WAITING_FOR_NEXT;
                    this.skipToNextVideo();
                }
            } else if (wasAd && !this.isAdCurrently) {
                if (this.videoState === VideoState.WAITING_FOR_NEXT) this.videoState = VideoState.ENDED;
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
            console.debug('[AdDetector] Skipping to next video', {
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

        this.player = null;
        this.videoElement = null;
        this.lastProgressSentTs = 0;
    }

    getCurrentAdState(): boolean {
        return this.isAdCurrently;
    }
}

class VideoTransitionTracker {
    private isTransitioning: boolean = false;
    private transitionTimer: number | null = null;
    private readonly TRANSITION_TIMEOUT = 5000;

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

function buildProgressPayload(video: HTMLVideoElement): ProgressUpdatePayload | null {
    const duration = video.duration;
    const currentTime = video.currentTime;
    if (!Number.isFinite(duration) || !Number.isFinite(currentTime)) return null;
    const vid = extractYouTubeIdFromUrl(location.href) ?? undefined;
    const info = getYouTubeVideoInfo();
    const now = Date.now();
    const payload: ProgressUpdatePayload = {
        type: 'progress_update',
        url: location.href,
        videoId: vid,
        currentTime,
        duration,
        playbackRate: video.playbackRate || 1,
        isBuffering: video.readyState < 3,
        visibilityState: document.visibilityState,
        timestamp: now,
        isAdvertisement: adDetector.getCurrentAdState(),
        musicTitle: info?.title,
        progressPercent: Number(((currentTime / duration) * 100).toFixed(2)),
    };
    return payload;
}

function sendProgressNow(video: HTMLVideoElement): void {
    try {
        const payload = buildProgressPayload(video);
        if (!payload) return;
        chrome.runtime.sendMessage(payload);
        adDetector.markProgressSent(payload.timestamp);
    } catch (e) {
        void e;
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
    if (location.href.includes('youtube.com/watch')) attachVideoListeners();
}

function findVideoElement(root: Document | ShadowRoot = document): HTMLVideoElement | null {
    const video = root.querySelector('video');
    if (video) return video;

    const allElements = Array.from(root.querySelectorAll('*'));
    for (const el of allElements) {
        const shadowRoot = (el as Element & { shadowRoot?: ShadowRoot }).shadowRoot;
        if (shadowRoot) {
            const shadowVideo = findVideoElement(shadowRoot);
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
                console.debug('[Content] notifyState', { state, currentTime, duration });
                chrome.runtime.sendMessage({
                    type: 'youtube_video_state',
                    url: location.href,
                    state,
                    currentTime,
                    timestamp: Date.now(),
                    isAdvertisement: isAd,
                });
                if (state === 'ended') chrome.storage.local.set({ latestUrl: 'ended' });
            } catch {
                return;
            }
        };

        video.addEventListener('ended', () => {
            const isAdPlaying = adDetector.getCurrentAdState();

            adDetector.markMainVideoEnded();

            console.debug('[Content] video ended event', {
                isAdPlaying,
                videoState: adDetector.getCurrentAdState(),
                currentTime: video.currentTime,
                duration: video.duration,
            });

            if (isAdPlaying) return;

            disableYouTubeAutoplay();
            transitionTracker.onVideoEnded(isAdPlaying);
            notifyState('ended');
        });

        video.addEventListener('play', () => {
            adDetector.resetToPlaying();
            transitionTracker.onVideoPlaying();
            console.debug('[Content] video play event', {
                currentTime: video.currentTime,
                duration: video.duration,
            });
            notifyState('playing');
            sendProgressNow(video);
        });

        video.addEventListener('pause', () => {
            const isAdPlaying = adDetector.getCurrentAdState();
            console.debug('[Content] video pause event', { isAdPlaying, currentTime: video.currentTime });
            if (transitionTracker.shouldIgnorePause(isAdPlaying)) return;
            notifyState('paused');
            sendProgressNow(video);
        });

        video.addEventListener('seeked', () => {
            sendProgressNow(video);
        });

        video.addEventListener('ratechange', () => {
            sendProgressNow(video);
        });

        video.addEventListener('waiting', () => {
            sendProgressNow(video);
        });

        video.addEventListener('playing', () => {
            sendProgressNow(video);
        });

        if (video.ended) notifyState('ended');
        else if (video.paused) notifyState('paused');
        else notifyState('playing');
    });
}

function isExtensionOpenedTab(): boolean {
    try {
        return window.sessionStorage.getItem('opened_by_extension') === '1';
    } catch {
        return false;
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
            chrome.runtime.sendMessage({ type: 'video_ended' }, () => {
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
        if (location.href !== lastHref) {
            lastHref = location.href;
            detectPageChange();
        }
    }, URL_CHECK_INTERVAL);

    detectPageChange();
    adDetector.start();
}
