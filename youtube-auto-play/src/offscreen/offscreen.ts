const SILENT_AUDIO_SRC = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=' as const;

let silentAudioStarted = false;
let silentAudioStartInFlight: Promise<void> | null = null;

const chromeAny = (globalThis as any).chrome as any;

function hasExtensionApis(): boolean {
    return typeof chromeAny?.runtime?.id === 'string' && typeof chromeAny?.runtime?.sendMessage === 'function';
}

async function ensureSilentAudioKeepAlive(): Promise<void> {
    if (silentAudioStarted) return;
    if (silentAudioStartInFlight) return await silentAudioStartInFlight;

    silentAudioStartInFlight = (async () => {
        // Consider “started” as: we attempted to start playback.
        // (In an offscreen document created with AUDIO_PLAYBACK reason, this should generally succeed.)
        try {
            const audio = document.createElement('audio');
            audio.autoplay = true;
            audio.loop = true;
            audio.muted = true;
            audio.volume = 0;
            try {
                audio.setAttribute('playsinline', '');
            } catch {
                // ignore
            }
            audio.src = SILENT_AUDIO_SRC;
            try {
                audio.setAttribute('data-offscreen-audio', '1');
            } catch {}

            document.body.appendChild(audio);
            silentAudioStarted = true;

            const p = audio.play();
            if (p && typeof (p as any).catch === 'function') {
                await (p as any).catch(() => {
                    // ignore
                });
            }
        } catch {
            // ignore
            silentAudioStarted = true;
        }
    })().finally(() => {
        silentAudioStartInFlight = null;
    });

    return await silentAudioStartInFlight;
}

function cleanupOffscreen(): void {
    try {
        let removed = 0;
        try {
            const audios = Array.from(document.querySelectorAll('audio'));
            for (const a of audios) {
                try {
                    const src = (a as HTMLAudioElement).src || '';
                    if ((a.hasAttribute && a.hasAttribute('data-offscreen-audio')) || src === SILENT_AUDIO_SRC) {
                        try {
                            (a as HTMLAudioElement).pause();
                        } catch {}
                        try {
                            a.remove();
                        } catch {}
                        removed += 1;
                    }
                } catch {}
            }
            silentAudioStarted = false;
        } catch {}
        try {
            chromeAny?.runtime?.sendMessage?.({
                type: 'offscreen_lifecycle',
                event: 'cleanup',
                data: { removedAudioCount: removed },
            });
        } catch {}
    } catch (err) {
        console.warn('[Offscreen] cleanup failed', err);
    }
}

chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;
    if (message.__fromSwInternal !== true) return false;

    if (message.type === 'audio_connect') {
        void ensureSilentAudioKeepAlive().then(
            () => {
                try {
                    sendResponse({ status: 'ok' });
                } catch {}
            },
            (err: any) => {
                try {
                    sendResponse({ status: 'error', error: err instanceof Error ? err.message : String(err) });
                } catch {}
            },
        );
        return true;
    }

    if (message.type === 'audio_disconnect') {
        try {
            cleanupOffscreen();
            try {
                sendResponse({ status: 'ok' });
            } catch {}
        } catch (err) {
            try {
                sendResponse({ status: 'error', error: err instanceof Error ? err.message : String(err) });
            } catch {}
        }
        return true;
    }

    return false;
});

console.log('[Offscreen] Script loaded', {
    hasChromeGlobal: typeof chrome !== 'undefined',
    hasChromeRuntime: typeof (globalThis as any)?.chrome?.runtime !== 'undefined',
    runtimeId: (globalThis as any)?.chrome?.runtime?.id,
    documentReadyState: document.readyState,
});

const tryInit = () => {
    console.log('[Offscreen] Attempting init');
    if (hasExtensionApis()) {
        console.log('[Offscreen] Starting initialization');
        ensureSilentAudioKeepAlive()
            .then(() => {
                console.log('[Offscreen] Init completed');
                try {
                    chromeAny?.runtime?.sendMessage?.({
                        type: 'offscreen_lifecycle',
                        event: 'init_completed',
                        data: {},
                    });
                } catch {}
            })
            .catch(err => {
                console.error('[Offscreen] Init failed', err);
                try {
                    chromeAny?.runtime?.sendMessage?.({
                        type: 'offscreen_lifecycle',
                        event: 'init_failed',
                        data: { error: String(err) },
                    });
                } catch {}
            });
    } else {
        console.warn('[Offscreen] Extension APIs not available, will retry');
        setTimeout(tryInit, 100);
    }
};

if (document.readyState === 'loading') {
    console.log('[Offscreen] Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Offscreen] DOMContentLoaded fired');
        tryInit();
    });
} else {
    console.log('[Offscreen] Document already ready');
    tryInit();
}

window.addEventListener('pagehide', cleanupOffscreen);
window.addEventListener('unload', cleanupOffscreen);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') cleanupOffscreen();
});
