import type { Store } from '@/server/persistence';
import type { Music } from '@/shared/types/music';

/**
 * A Store that keeps nothing. Tests that only exercise the in-memory queue still need one:
 * MusicRepository forwards to it, and passing `undefined as any` makes every persist path
 * throw a TypeError that the repository then reports as a genuine persistence failure.
 */
export function createMemoryStore(): Store {
    let items: Music[] = [];
    return {
        add(music: Music, atIndex?: number) {
            if (atIndex == undefined) items.push(music);
            else items.splice(Math.max(0, Math.min(atIndex, items.length)), 0, music);
        },
        clear() {
            items = [];
        },
        load() {
            return items.slice();
        },
        remove(id: string) {
            items = items.filter(item => item.id !== id);
        },
        reorder(next: Music[]) {
            items = next.slice();
        },
    };
}
