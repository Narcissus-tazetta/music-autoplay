import type { Music } from '@/shared/stores/musicStore';
import normalizeApiResponse from '@/shared/utils/api';
import { parseApiErrorForUI } from '@/shared/utils/apiUi';
import { useEffect } from 'react';

const isMusic = (v: unknown): v is Music => {
    if (!v || typeof v !== 'object') return false;
    const r = v as Record<string, unknown>;
    return (
        typeof r.id === 'string'
        && typeof r.title === 'string'
        && typeof r.channelName === 'string'
        && typeof r.channelId === 'string'
        && typeof r.duration === 'string'
    );
};

export function useAppInitialization(): void {
    useEffect(() => {
        const run = async () => {
            const { useMusicStore } = await import('@/shared/stores/musicStore');
            const store = useMusicStore.getState();
            try {
                const resp = await fetch('/api/settings');
                if (resp.ok && resp.status === 200) {
                    const rawData: unknown = await resp.json();
                    const { z } = await import('zod');
                    const SettingsSchema = z
                        .object({ ytStatusVisible: z.boolean().optional() })
                        .passthrough();
                    const parsed = SettingsSchema.safeParse(rawData);
                    if (
                        parsed.success
                        && typeof parsed.data.ytStatusVisible === 'boolean'
                    ) {
                        const { useSettingsStore } = await import('@/shared/stores/settingsStore');
                        useSettingsStore
                            .getState()
                            .setYtStatusVisible(parsed.data.ytStatusVisible);
                    }
                }
            } catch (error) {
                if (import.meta.env.DEV) console.debug('loadFromServer failed', error);
            }

            try {
                store.connectSocket();
            } catch (error) {
                if (import.meta.env.DEV) {
                    if (error instanceof Error) console.error('connectSocket failed', error);
                    else console.error('connectSocket failed', String(error));
                }
            }
            const doBackgroundFetch = async () => {
                const doFetchOnce = async (signal: AbortSignal) => {
                    const resp = await fetch('/api/musics', {
                        cache: 'no-store',
                        signal,
                    });
                    const norm = await normalizeApiResponse<{ musics: unknown[] }>(resp);

                    if (!norm.success) {
                        try {
                            const parsed = parseApiErrorForUI({
                                code: norm.error.code,
                                details: norm.error.details,
                                message: norm.error.message,
                            });

                            if (import.meta.env.DEV) {
                                console.debug(
                                    '/api/musics responded with parsed error:',
                                    parsed,
                                );
                            }

                            try {
                                const mod = await import('@/shared/utils/uiActionExecutor');
                                mod.executeParsedApiError(parsed, { conformFields: undefined });
                            } catch (error) {
                                if (import.meta.env.DEV) console.error('uiActionExecutor failed', error);
                            }

                            if (parsed.kind === 'unauthorized') return;
                        } catch (error) {
                            if (import.meta.env.DEV) console.debug('parseApiErrorForUI failed', error);
                        }
                        const maybeErr: unknown = norm.error;
                        let fallbackMsg = 'Unknown error';
                        if (
                            typeof maybeErr === 'object'
                            && maybeErr !== null
                            && 'message' in maybeErr
                        ) {
                            const m = (maybeErr as Record<string, unknown>).message;
                            if (typeof m === 'string') fallbackMsg = m;
                        } else if (typeof maybeErr === 'string') fallbackMsg = maybeErr;
                        else {
                            try {
                                fallbackMsg = JSON.stringify(maybeErr);
                            } catch {
                                fallbackMsg = String(maybeErr);
                            }
                        }

                        throw new Error('fetch /api/musics failed: ' + fallbackMsg);
                    }

                    const musicsRaw = (norm.data as { musics?: unknown } | null)?.musics;
                    if (!Array.isArray(musicsRaw)) throw new Error('no-musics');
                    const maybeMusics = musicsRaw;
                    const musics = maybeMusics.filter(isMusic);
                    store.setMusics?.(musics);
                };

                const attempts = [0, 500, 1000];
                for (let i = 0; i < attempts.length; i++) {
                    // oxlint-disable-next-line no-await-in-loop
                    if (i > 0) await new Promise(r => setTimeout(r, attempts[i]));
                    const controller = new AbortController();
                    const timeout = setTimeout(() => {
                        controller.abort();
                    }, 3000);
                    try {
                        // oxlint-disable-next-line no-await-in-loop
                        await doFetchOnce(controller.signal);
                        clearTimeout(timeout);
                        break;
                    } catch (error) {
                        clearTimeout(timeout);
                        if (import.meta.env.DEV) {
                            console.debug('/api/musics fetch attempt failed', {
                                attempt: i + 1,
                                error: error instanceof Error ? error.message : String(error),
                            });
                            if (i === attempts.length - 1) {
                                console.debug(
                                    '/api/musics all attempts failed, relying on socket',
                                );
                            }
                        }
                    }
                }
            };

            let fetchSucceeded = false;
            try {
                await doBackgroundFetch();
                fetchSucceeded = true;
            } catch {
                if (import.meta.env.DEV) console.debug('background /api/musics task failed');
            }
            if (!fetchSucceeded) {
                try {
                    store.hydrateFromLocalStorage?.();
                } catch (error) {
                    if (import.meta.env.DEV) console.debug('hydrateFromLocalStorage failed', error);
                }
            }
        };

        run().catch(error => {
            if (import.meta.env.DEV) {
                if (error instanceof Error) console.error(error);
                else {
                    console.error(
                        typeof error === 'string' ? error : JSON.stringify(error),
                    );
                }
            }
        });
    }, []);
}
