import type { SessionRole } from '@/app/stores/adminStore';
import { useAdminStore } from '@/app/stores/adminStore';
import { useMusicStore } from '@/app/stores/musicStore';
import { notify } from '@/app/utils/notifications';
import type { Music } from '@/shared/types/music';
import { normalizeApiResponse } from '@/shared/utils/api';
import { useEffect } from 'react';

const SEED_FETCH_TIMEOUT_MS = 3_000;
const SEED_RETRY_DELAYS_MS = [0, 500, 1_000];

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

async function loadRoles(signal: AbortSignal): Promise<void> {
    const res = await fetch('/api/admin/status', { signal });
    if (!res.ok) return;

    const data = await res.json() as { isAdmin?: boolean; roles?: unknown };
    const roles = Array.isArray(data.roles) ? [...data.roles as SessionRole[]] : [];
    if (data.isAdmin === true && !roles.includes('admin')) roles.push('admin');
    useAdminStore.getState().setRoles(roles);
}

/**
 * Only a seed for the first paint: the socket owns the queue, and `seedMusics` is a no-op
 * once its snapshot has landed, so a slow response here can never resurrect a stale list.
 */
async function seedMusicsFromApi(signal: AbortSignal): Promise<void> {
    for (const retryDelay of SEED_RETRY_DELAYS_MS) {
        if (useMusicStore.getState().hasServerSnapshot || signal.aborted) return;
        // oxlint-disable-next-line no-await-in-loop
        if (retryDelay > 0) await new Promise(r => setTimeout(r, retryDelay));

        try {
            const revision = useMusicStore.getState().queueRevision;
            // oxlint-disable-next-line no-await-in-loop
            const res = await fetch('/api/musics', {
                cache: 'no-store',
                signal: AbortSignal.any([signal, AbortSignal.timeout(SEED_FETCH_TIMEOUT_MS)]),
            });
            // oxlint-disable-next-line no-await-in-loop
            const norm = await normalizeApiResponse<{ musics: unknown[] }>(res);
            if (!norm.success) throw new Error(norm.error.message);

            const musics = norm.data?.musics;
            if (!Array.isArray(musics)) throw new Error('/api/musics returned no queue');

            if (revision !== useMusicStore.getState().queueRevision) continue;
            useMusicStore.getState().seedMusics(musics.filter(isMusic), revision);
            return;
        } catch (error) {
            if (signal.aborted) return;
            if (import.meta.env.DEV) console.debug('/api/musics seed attempt failed', error);
        }
    }
    console.warn('/api/musics seed gave up; the queue will fill in over the socket');
    notify({ level: 'warning', message: '再生リストを取得できません。接続が戻ると自動で同期します。' });
}

export function useAppInitialization(): void {
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        useMusicStore.getState().connectSocket();

        const settle = (label: string) => (error: unknown) => {
            if (signal.aborted) return;
            console.warn(`app initialization: ${label} failed`, error);
        };
        loadRoles(signal).catch(settle('admin status'));
        void seedMusicsFromApi(signal);

        return () => {
            controller.abort();
        };
    }, []);
}
