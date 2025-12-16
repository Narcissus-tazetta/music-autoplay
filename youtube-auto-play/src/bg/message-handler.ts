import { MESSAGE_TYPES, TIMING, YOUTUBE_WATCH_URL_PATTERN } from '../constants';
import type { BatchProgressUpdateMessage, ChromeMessage, ChromeMessageResponse, ProgressUpdatePayload } from '../types';
import type { MessageSender, SocketInstance } from './types';

import { handleVideoEnded, handleYouTubeVideoState } from './youtube-state';

interface MoveVideoMessage {
    type: 'move_prev_video' | 'move_next_video';
    url: string;
}

interface DeleteUrlMessage {
    type: 'delete_url';
    url: string;
}

type MessageResponse = { status: 'ok' } | { status: 'error'; error: string };

function safeSendResponse(
    sendResponse: (response: MessageResponse) => void,
    response: MessageResponse,
): void {
    try {
        sendResponse(response);
    } catch {
        // sendResponseがすでに呼ばれた場合は無視
    }
}

function hasChromeError(): boolean {
    return !!chrome.runtime.lastError;
}

function getChromeErrorMessage(): string {
    return chrome.runtime.lastError?.message || 'Unknown error';
}

/* eslint-disable no-console */
export function setupMessageHandler(socket: SocketInstance): void {
    // Flush any buffered progress updates when socket connects
    try {
        socket.on('connect', () => {
            flushProgressBuffer(socket);
        });
    } catch {}
    chrome.runtime.onMessage.addListener(
        (
            message: ChromeMessage,
            sender: MessageSender,
            sendResponse: (response: MessageResponse) => void,
        ) => {
            const msg = message;

            if (msg.type === 'move_prev_video' || msg.type === 'move_next_video') {
                if (msg.url && typeof msg.url === 'string') {
                    handleMoveVideo({ type: msg.type, url: msg.url }, socket, sendResponse);
                    return true;
                }
            }

            if (msg.type === 'youtube_video_state') {
                if (msg.state && msg.url && typeof msg.state === 'string' && typeof msg.url === 'string') {
                    handleYouTubeVideoState(
                        { type: msg.type, state: msg.state, url: msg.url },
                        sender,
                        socket,
                    );
                }
                return false;
            }

            if (msg.type === 'reconnect_socket') {
                if (!socket.connected) socket.connect();
                return false;
            }

            if (msg.type === MESSAGE_TYPES.REQUEST_URL_LIST) {
                try {
                    if (socket.connected) socket.emit('request_url_list', () => {});
                    else {
                        (socket as any).once('connect', () => {
                            try {
                                socket.emit('request_url_list');
                            } catch {}
                        });
                        try {
                            socket.connect();
                        } catch {}
                    }
                } catch {}
                return false;
            }

            if (msg.type === 'show_video_end_alert') {
                handleVideoEndAlert();
                return false;
            }

            if (msg.type === 'delete_url') {
                if (msg.url && typeof msg.url === 'string') {
                    handleDeleteUrl({ type: msg.type, url: msg.url }, socket, sendResponse);
                    return true;
                }
            }

            if (msg.type === 'add_external_music') {
                handleAddExternalMusic(socket, sendResponse);
                return true;
            }
            if (msg.type === 'ad_state_changed') {
                if (msg.isAd !== undefined && msg.url && typeof msg.url === 'string') {
                    handleAdStateChanged({ type: msg.type, isAd: msg.isAd, url: msg.url }, socket);
                    console.info('[Background] ad_state_changed received', { url: msg.url, isAd: msg.isAd });
                }
                sendResponse({ status: 'ok' });
                return false;
            }

            if (msg.type === 'ad_skip_to_next') {
                console.info('[Background] ad_skip_to_next received', {
                    url: msg.url,
                    tabId: sender?.tab?.id,
                });
                if (msg.url && typeof msg.url === 'string')
                    handleAdSkipToNext({ type: msg.type, url: msg.url }, sender as MessageSender, socket);
                return false;
            }

            if (msg.type === 'progress_update') {
                if (
                    msg.url
                    && typeof msg.url === 'string'
                    && typeof msg.currentTime === 'number'
                    && typeof msg.duration === 'number'
                    && typeof msg.timestamp === 'number'
                ) {
                    handleProgressUpdate(msg as ProgressUpdatePayload, socket);
                }
                return false;
            }

            if (msg.type === 'batch_progress_update') {
                if (Array.isArray(msg.updates)) {
                    handleBatchProgressUpdate(
                        msg as { type: 'batch_progress_update'; updates: ProgressUpdatePayload[] },
                        socket,
                    );
                }
                return false;
            }

            return false;
        },
    );
}

function handleAdStateChanged(
    message: {
        type: 'ad_state_changed';
        isAd: boolean;
        url: string;
        timestamp?: number;
        videoId?: string;
    },
    socket: SocketInstance,
): void {
    if (!socket.connected) {
        console.warn('[Background] Socket not connected, skipping ad state emission');
        return;
    }

    console.debug('[Background] handleAdStateChanged', { url: message.url, isAd: message.isAd });

    try {
        socket.emit('ad_state_changed', {
            url: message.url,
            isAd: message.isAd,
            timestamp: message.timestamp ?? Date.now(),
            videoId: message.videoId,
        });
    } catch (error) {
        console.error('[Background] Failed to emit ad state change', error);
    }
}

function handleAdSkipToNext(
    message: { type: 'ad_skip_to_next'; url: string },
    sender: { tab?: { id?: number } },
    socket: SocketInstance,
): void {
    const tabId = sender?.tab?.id;

    if (!tabId) {
        console.warn('[Background] handleAdSkipToNext: no tabId available');
        return;
    }

    console.info('[Background] handleAdSkipToNext: invoking handleVideoEnded', {
        url: message.url,
        tabId,
    });

    handleVideoEnded(message.url, tabId, socket);
}

function handleProgressUpdate(message: ProgressUpdatePayload, socket: SocketInstance): void {
    if (!socket.connected) {
        bufferProgress(message);
        try {
            socket.connect();
        } catch {}
        return;
    }

    try {
        const receivedAt = Date.now();
        const clientLatencyMs = receivedAt - message.timestamp;
        const payload = {
            url: message.url,
            videoId: message.videoId,
            currentTime: message.currentTime,
            duration: message.duration,
            playbackRate: message.playbackRate,
            isBuffering: message.isBuffering,
            visibilityState: message.visibilityState,
            timestamp: message.timestamp ?? receivedAt,
            isAdvertisement: message.isAdvertisement,
            musicTitle: message.musicTitle,
            tabId: message.tabId,
            progressPercent: message.progressPercent,
            consecutiveStalls: message.consecutiveStalls,
            clientLatencyMs,
        } as Record<string, unknown>;

        socket.emit('progress_update', payload);
    } catch (error) {
        console.error('[Background] Failed to emit progress_update', error);
    }
}

function handleBatchProgressUpdate(
    message: BatchProgressUpdateMessage,
    socket: SocketInstance,
): void {
    if (!Array.isArray(message.updates)) return;
    if (!socket.connected) {
        message.updates.forEach(u => bufferProgress(u));
        try {
            socket.connect();
        } catch {}
        return;
    }

    try {
        const receivedAt = Date.now();
        socket.emit('progress_update_batch', {
            updates: message.updates.map(update => {
                const clientLatencyMs = receivedAt - update.timestamp;
                return {
                    url: update.url,
                    videoId: update.videoId,
                    currentTime: update.currentTime,
                    duration: update.duration,
                    playbackRate: update.playbackRate,
                    isBuffering: update.isBuffering,
                    visibilityState: update.visibilityState,
                    timestamp: update.timestamp ?? receivedAt,
                    isAdvertisement: update.isAdvertisement,
                    musicTitle: update.musicTitle,
                    tabId: update.tabId,
                    progressPercent: update.progressPercent,
                    consecutiveStalls: update.consecutiveStalls,
                    clientLatencyMs,
                };
            }),
        });
    } catch (error) {
        console.error('[Background] Failed to emit batched progress_update', error);
    }
}

const PROGRESS_BUFFER: ProgressUpdatePayload[] = [];
const MAX_PROGRESS_BUFFER = 300;

function bufferProgress(msg: ProgressUpdatePayload): void {
    if (PROGRESS_BUFFER.length >= MAX_PROGRESS_BUFFER) PROGRESS_BUFFER.shift();
    PROGRESS_BUFFER.push(msg);
}

function flushProgressBuffer(socket: SocketInstance): void {
    if (!socket.connected || PROGRESS_BUFFER.length === 0) return;
    const updates = PROGRESS_BUFFER.splice(0, PROGRESS_BUFFER.length);
    try {
        const receivedAt = Date.now();
        socket.emit('progress_update_batch', {
            updates: updates.map(u => {
                const clientLatencyMs = receivedAt - u.timestamp;
                return {
                    url: u.url,
                    videoId: u.videoId,
                    currentTime: u.currentTime,
                    duration: u.duration,
                    playbackRate: u.playbackRate,
                    isBuffering: u.isBuffering,
                    visibilityState: u.visibilityState,
                    timestamp: u.timestamp ?? receivedAt,
                    isAdvertisement: u.isAdvertisement,
                    musicTitle: u.musicTitle,
                    tabId: u.tabId,
                    progressPercent: u.progressPercent,
                    consecutiveStalls: u.consecutiveStalls,
                    clientLatencyMs,
                };
            }),
        });
    } catch (error) {
        console.error('[Background] Failed to flush progress buffer', error);
        PROGRESS_BUFFER.unshift(...updates);
    }
}

function handleMoveVideo(
    message: MoveVideoMessage,
    socket: SocketInstance,
    sendResponse: (response: MessageResponse) => void,
): void {
    try {
        if (!socket.connected) socket.connect();

        socket.emit(message.type, { url: message.url }, () => {
            safeSendResponse(sendResponse, { status: 'ok' });
        });
    } catch (error) {
        console.error('[Background] handleMoveVideo failed', error);
        safeSendResponse(sendResponse, { status: 'error', error: String(error) });
    }
}
let videoEndAlertShown = false;

function handleVideoEndAlert(): void {
    if (videoEndAlertShown) {
        console.debug('[Background] Video end alert already shown, skipping');
        return;
    }

    videoEndAlertShown = true;
    setTimeout(() => {
        videoEndAlertShown = false;
    }, TIMING.VIDEO_END_ALERT_TIMEOUT);
}

function handleDeleteUrl(
    message: DeleteUrlMessage,
    socket: SocketInstance,
    sendResponse: (response: MessageResponse) => void,
): void {
    try {
        socket.emit('delete_url', message.url, () => {
            safeSendResponse(sendResponse, { status: 'ok' });
        });
    } catch (error) {
        console.error('[Background] handleDeleteUrl failed', error);
        safeSendResponse(sendResponse, { status: 'error', error: String(error) });
    }
}

/* eslint-enable no-console */

function handleAddExternalMusic(
    socket: SocketInstance,
    sendResponse: (response: MessageResponse) => void,
): void {
    chrome.tabs.query({ active: true, url: YOUTUBE_WATCH_URL_PATTERN }, tabs => {
        if (hasChromeError()) {
            console.error('[Background] Failed to query active tab', chrome.runtime.lastError);
            safeSendResponse(sendResponse, { status: 'error', error: getChromeErrorMessage() });
            return;
        }

        if (tabs.length === 0 || !tabs[0].id) {
            console.warn('[Background] No active YouTube tab found');
            safeSendResponse(sendResponse, { status: 'error', error: 'No active YouTube tab' });
            return;
        }

        chrome.tabs.sendMessage(
            tabs[0].id,
            { type: 'get_video_info' },
            (response: ChromeMessageResponse) => {
                if (hasChromeError()) {
                    console.error('[Background] Failed to get video info from tab', chrome.runtime.lastError);
                    safeSendResponse(sendResponse, {
                        status: 'error',
                        error: 'Failed to communicate with tab',
                    });
                    return;
                }

                if (response?.status === 'ok' && response.url && response.title) {
                    if (!socket.connected) socket.connect();

                    socket.emit('external_music_add', {
                        url: response.url,
                        title: response.title,
                    });

                    safeSendResponse(sendResponse, { status: 'ok' });
                } else {
                    console.warn('[Background] Invalid video info response', response);
                    safeSendResponse(sendResponse, { status: 'error', error: 'Failed to get video info' });
                }
            },
        );
    });
}
