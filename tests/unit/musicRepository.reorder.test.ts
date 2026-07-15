import { MusicRepository } from '@/server/music/repository/musicRepository';
import { INSERT_AT_FRONT } from '@/shared/schemas/music';
import type { Music } from '@/shared/stores/musicStore';
import { describe, expect, it } from 'bun:test';

function makeMusic(id: string): Music {
    return {
        channelId: 'channel',
        channelName: 'Channel',
        duration: 'PT3M',
        id,
        title: `Title ${id}`,
    };
}

describe('MusicRepository ordering', () => {
    it('add() without atIndex appends to the end', () => {
        const repo = new MusicRepository(new Map(), undefined as never);
        repo.add(makeMusic('a'));
        repo.add(makeMusic('b'));
        repo.add(makeMusic('c'));

        expect(repo.list().map(m => m.id)).toEqual(['a', 'b', 'c']);
    });

    it('add() with atIndex inserts at the given position', () => {
        const repo = new MusicRepository(new Map(), undefined as never);
        repo.add(makeMusic('a'));
        repo.add(makeMusic('b'));
        repo.add(makeMusic('c'), 1);

        expect(repo.list().map(m => m.id)).toEqual(['a', 'c', 'b']);
    });

    it('add() clamps an out-of-range atIndex', () => {
        const repo = new MusicRepository(new Map(), undefined as never);
        repo.add(makeMusic('a'));
        repo.add(makeMusic('b'), 999);

        expect(repo.list().map(m => m.id)).toEqual(['a', 'b']);
    });

    it('reorder() moves an entry directly after the anchor', () => {
        const repo = new MusicRepository(new Map(), undefined as never);
        repo.add(makeMusic('a'));
        repo.add(makeMusic('b'));
        repo.add(makeMusic('c'));

        const result = repo.reorder('a', 'b');

        expect(result.ok).toBe(true);
        expect(repo.list().map(m => m.id)).toEqual(['b', 'a', 'c']);
    });

    it('reorder() moves an entry to the front with INSERT_AT_FRONT', () => {
        const repo = new MusicRepository(new Map(), undefined as never);
        repo.add(makeMusic('a'));
        repo.add(makeMusic('b'));
        repo.add(makeMusic('c'));

        const result = repo.reorder('c', INSERT_AT_FRONT);

        expect(result.ok).toBe(true);
        expect(repo.list().map(m => m.id)).toEqual(['c', 'a', 'b']);
    });

    it('reorder() falls back to the front when the anchor is missing', () => {
        const repo = new MusicRepository(new Map(), undefined as never);
        repo.add(makeMusic('a'));
        repo.add(makeMusic('b'));
        repo.add(makeMusic('c'));

        const result = repo.reorder('c', 'gone');

        expect(result.ok).toBe(true);
        expect(repo.list().map(m => m.id)).toEqual(['c', 'a', 'b']);
    });

    it('reorder() is a no-op when the anchor is the entry itself', () => {
        const repo = new MusicRepository(new Map(), undefined as never);
        repo.add(makeMusic('a'));
        repo.add(makeMusic('b'));

        const result = repo.reorder('a', 'a');

        expect(result.ok).toBe(true);
        expect(repo.list().map(m => m.id)).toEqual(['a', 'b']);
    });

    it('reorder() returns an error for an unknown id', () => {
        const repo = new MusicRepository(new Map(), undefined as never);
        repo.add(makeMusic('a'));

        const result = repo.reorder('missing', INSERT_AT_FRONT);

        expect(result.ok).toBe(false);
    });
});
