import type { SessionRole } from '@/app/stores/adminStore';
import { useAdminStore } from '@/app/stores/adminStore';
import { useMusicStore } from '@/app/stores/musicStore';
import type { Music } from '@/shared/types/music';
import normalizeApiResponse from '@/shared/utils/api';
import { parseApiErrorForUI } from '@/shared/utils/apiUi';
import { runParsedApiError } from '@/shared/utils/runUiAction';
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
            try {
                const res = await fetch('/api/admin/status');
                if (res.ok) {
                    const data = await res.json() as { isAdmin?: boolean; roles?: unknown };
                    const roles = Array.isArray(data.roles) ? [...data.roles as SessionRole[]] : [];
                    if (data.isAdmin === true && !roles.includes('admin')) roles.push('admin');
                    useAdminStore.getState().setRoles(roles);
                }
            } catch {
                if (import.meta.env.DEV) console.debug('admin status check failed');
            }

            const store = useMusicStore.getState();
            try {
                store.connectSocket();
            } catch (error) {
                if (import.meta.env.DEV) {
                    if (error instanceof Error) console.error('connectSocket failed', error);
                    else console.error('connectSocket failed', String(error));
                }
            }
            const doBackgroundFetch = async (): Promise<boolean> => {
                const doFetchOnce = async (signal: AbortSignal) => {
                    const revision = useMusicStore.getState().queueRevision;
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

                            await runParsedApiError(parsed);

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
                    if (revision !== useMusicStore.getState().queueRevision) throw new Error('queue-changed');
                    store.setMusics?.(musics, revision);
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
                        return true;
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
                return false;
            };

            let fetchSucceeded = false;
            try {
                fetchSucceeded = await doBackgroundFetch();
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
