import type { Music } from '@/shared/stores/musicStore';
import normalizeApiResponse from '@/shared/utils/api';
import { parseApiErrorForUI } from '@/shared/utils/apiUi';
import { useEffect } from 'react';

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
                        const { useSettingsStore } = await import(
                            '@/shared/stores/settingsStore'
                        );
                        useSettingsStore
                            .getState()
                            .setYtStatusVisible(parsed.data.ytStatusVisible);
                    }
                }
            } catch (err: unknown) {
                if (import.meta.env.DEV) console.debug('loadFromServer failed', err);
            }

            try {
                store.connectSocket();
            } catch (err: unknown) {
                if (import.meta.env.DEV) {
                    if (err instanceof Error) console.error('connectSocket failed', err);
                    else console.error('connectSocket failed', String(err));
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
                                message: norm.error.message,
                                details: norm.error.details,
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
                            } catch (err: unknown) {
                                if (import.meta.env.DEV) console.error('uiActionExecutor failed', err);
                            }

                            if (parsed.kind === 'unauthorized') return;
                        } catch (err: unknown) {
                            if (import.meta.env.DEV) console.debug('parseApiErrorForUI failed', err);
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

                    const musics = maybeMusics.filter(isMusic);
                    store.setMusics?.(musics);
                };

                const attempts = [0, 500, 1000];
                for (let i = 0; i < attempts.length; i++) {
                    if (i > 0) await new Promise(r => setTimeout(r, attempts[i]));
                    const controller = new AbortController();
                    const timeout = setTimeout(() => {
                        controller.abort();
                    }, 3000);
                    try {
                        await doFetchOnce(controller.signal);
                        clearTimeout(timeout);
                        break;
                    } catch (err: unknown) {
                        clearTimeout(timeout);
                        if (import.meta.env.DEV) {
                            console.debug('/api/musics fetch attempt failed', {
                                attempt: i + 1,
                                error: err instanceof Error ? err.message : String(err),
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
                } catch (err: unknown) {
                    if (import.meta.env.DEV) console.debug('hydrateFromLocalStorage failed', err);
                }
            }
        };

        run().catch((err: unknown) => {
            if (import.meta.env.DEV) {
                if (err instanceof Error) console.error(err);
                else console.error(typeof err === 'string' ? err : JSON.stringify(err));
            }
        });
    }, []);
}
