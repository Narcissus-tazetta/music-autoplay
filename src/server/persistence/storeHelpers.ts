import logger from '@/server/logger';
import type { Music } from '@/shared/stores/musicStore';
import type { Store } from './types';

export async function persistAdd(
    store: Store | undefined,
    music: Music,
): Promise<void> {
    if (!store || typeof store.add !== 'function') return;
    try {
        const res = store.add(music);
        if (res && typeof (res as { then?: unknown }).then === 'function') await res;
    } catch (error) {
        try {
            logger.warn('failed to persist music add', {
                error: error,
                id: music.id,
            });
        } catch (error) {
            void error;
        }
    }
}

export async function persistRemove(
    store: Store | undefined,
    id: string,
): Promise<void> {
    if (!store || typeof store.remove !== 'function') return;
    try {
        const res = store.remove(id);
        if (res && typeof (res as { then?: unknown }).then === 'function') await res;
    } catch (error) {
        try {
            logger.warn('failed to persist music removal', { error: error, id });
        } catch (error) {
            void error;
        }
    }
}
