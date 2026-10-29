import type { Music } from '@/shared/types/music';
import type { Store } from './types';

/**
 * Awaits the store's own async write so a rejection reaches the caller.
 *
 * These used to catch and log, then return normally, which made every persist look like a
 * success to MusicRepository — the `if (!persistResult.ok)` branches above it were dead and
 * a full disk went unreported.
 */
export async function persistAdd(store: Store, music: Music, atIndex?: number): Promise<void> {
    await store.add(music, atIndex);
}

export async function persistRemove(store: Store, id: string): Promise<void> {
    await store.remove(id);
}
