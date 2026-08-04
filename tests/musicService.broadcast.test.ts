import { AuthChecker } from '@/server/music/authChecker';
import { MusicEventEmitter } from '@/server/music/musicEventEmitter';
import { MusicRepository } from '@/server/music/musicRepository';
import { MusicService } from '@/server/music/musicService';
import type { YouTubeResolver } from '@/server/music/youtubeResolver';
import type { Music } from '@/shared/types/music';
import { ok } from '@/shared/utils/errors/result-handlers';
import { describe, expect, it } from 'bun:test';

/**
 * The events the browser relies on to keep its queue in sync. addMusic, removeMusic and
 * reorderMusic each used to inline the same url_list broadcast; they now share
 * emitUrlListUpdate(), so these tests pin the events and payloads each path emits.
 */

function makeMusic(id: string, requesterHash?: string): Music {
    return {
        channelId: 'channel',
        channelName: 'Channel',
        duration: 'PT3M',
        id,
        requesterHash,
        title: `Title ${id}`,
    };
}

function makeResolver(id: string): YouTubeResolver {
    return {
        resolve: async () =>
            ok({
                channelId: 'channel',
                channelTitle: 'Channel',
                duration: 'PT3M',
                id,
                title: `Title ${id}`,
            }),
        validateMetadata: () => ok(undefined),
    } as unknown as YouTubeResolver;
}

function setup(initial: Music[]) {
    const repository = new MusicRepository(new Map(), undefined as never);
    for (const m of initial) repository.add(m);

    const emitted: { event: string; payload: unknown }[] = [];
    const emitter = new MusicEventEmitter((event, payload) => {
        emitted.push({ event, payload });
        return true;
    });

    return { emitted, emitter, repository };
}

const OWNER = 'owner-hash';

const urlListIds = (payload: unknown) => (payload as { id: string }[]).map(m => m.id);

describe('MusicService broadcasts', () => {
    it('removeMusic emits musicRemoved and the refreshed url_list', async () => {
        const { emitted, emitter, repository } = setup([makeMusic('a', OWNER), makeMusic('b', OWNER)]);
        const service = new MusicService(new AuthChecker(), makeResolver('a'), repository, emitter);

        const result = await service.removeMusic({ requesterHash: OWNER, url: 'https://youtu.be/a' });
        expect(result.ok).toBe(true);

        const removed = emitted.find(e => e.event === 'musicRemoved');
        expect(removed?.payload).toBe('a');

        const urlList = emitted.find(e => e.event === 'url_list');
        expect(urlList).toBeDefined();
        // The snapshot must reflect the removal, not the pre-removal queue.
        expect(urlListIds(urlList?.payload)).toEqual(['b']);
    });

    it('removeMusic emits musicRemoved before url_list', async () => {
        const { emitted, emitter, repository } = setup([makeMusic('a', OWNER), makeMusic('b', OWNER)]);
        const service = new MusicService(new AuthChecker(), makeResolver('a'), repository, emitter);

        await service.removeMusic({ requesterHash: OWNER, url: 'https://youtu.be/a' });

        const order = emitted.map(e => e.event).filter(e => e === 'musicRemoved' || e === 'url_list');
        expect(order).toEqual(['musicRemoved', 'url_list']);
    });

    it('addMusic emits musicAdded and a url_list containing the new entry', async () => {
        const { emitted, emitter, repository } = setup([makeMusic('a', OWNER)]);
        const service = new MusicService(new AuthChecker(), makeResolver('b'), repository, emitter);

        const result = await service.addMusic({ url: 'https://youtu.be/b' });
        expect(result.ok).toBe(true);

        expect(emitted.some(e => e.event === 'musicAdded')).toBe(true);
        const urlList = emitted.find(e => e.event === 'url_list');
        expect(urlListIds(urlList?.payload)).toEqual(['a', 'b']);
    });

    it('reorderMusic emits queueReordered and a url_list in the new order', async () => {
        const { emitted, emitter, repository } = setup([makeMusic('a', OWNER), makeMusic('b', OWNER)]);
        const service = new MusicService(new AuthChecker(), makeResolver('a'), repository, emitter);

        const result = await service.reorderMusic({ afterId: 'b', id: 'a', requesterHash: OWNER });
        expect(result.ok).toBe(true);

        expect(emitted.some(e => e.event === 'queueReordered')).toBe(true);
        const urlList = emitted.find(e => e.event === 'url_list');
        expect(urlListIds(urlList?.payload)).toEqual(['b', 'a']);
    });

    it('url_list entries carry the watch url the extension needs', async () => {
        const { emitted, emitter, repository } = setup([makeMusic('a', OWNER), makeMusic('b', OWNER)]);
        const service = new MusicService(new AuthChecker(), makeResolver('a'), repository, emitter);

        await service.removeMusic({ requesterHash: OWNER, url: 'https://youtu.be/a' });

        const urlList = emitted.find(e => e.event === 'url_list');
        const entries = urlList?.payload as { id: string; url: string }[];
        expect(entries[0].url).toBe('https://www.youtube.com/watch?v=b');
    });

    it('a rejected removal broadcasts nothing', async () => {
        const { emitted, emitter, repository } = setup([makeMusic('a', 'owner-hash')]);
        const service = new MusicService(new AuthChecker(), makeResolver('a'), repository, emitter);

        // A different requester does not own this entry, so it must survive untouched.
        const result = await service.removeMusic({ requesterHash: 'someone-else', url: 'https://youtu.be/a' });

        expect(result.ok).toBe(false);
        expect(emitted.some(e => e.event === 'musicRemoved' || e.event === 'url_list')).toBe(false);
        expect(repository.list().map(m => m.id)).toEqual(['a']);
    });
});
