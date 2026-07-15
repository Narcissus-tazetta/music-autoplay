import { AuthChecker } from '@/server/music/auth/authChecker';
import { MusicEventEmitter } from '@/server/music/emitter/musicEventEmitter';
import { MusicService } from '@/server/music/musicService';
import { MusicRepository } from '@/server/music/repository/musicRepository';
import type { YouTubeResolver } from '@/server/music/resolver/youtubeResolver';
import type { Music } from '@/shared/stores/musicStore';
import { ok } from '@/shared/utils/errors/result-handlers';
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

describe('MusicService.addMusic ordering broadcast', () => {
    it('emits queueReordered with the authoritative order when inserted mid-queue', async () => {
        const repository = new MusicRepository(new Map(), undefined as never);
        repository.add(makeMusic('a'));
        repository.add(makeMusic('b'));

        const emitted: Array<{ event: string; payload: unknown }> = [];
        const emitter = new MusicEventEmitter((event, payload) => {
            emitted.push({ event, payload });
            return true;
        });

        const service = new MusicService(new AuthChecker(), makeResolver('c'), repository, emitter);

        const result = await service.addMusic({ insertAfterId: 'a', url: 'https://youtu.be/c' });

        expect(result.ok).toBe(true);
        expect(repository.list().map(m => m.id)).toEqual(['a', 'c', 'b']);

        const reordered = emitted.find(e => e.event === 'queueReordered');
        expect(reordered).toBeDefined();
        const payload = reordered as { event: string; payload: unknown };
        expect((payload.payload as Music[]).map(m => m.id)).toEqual(['a', 'c', 'b']);
    });

    it('does not emit queueReordered for a plain append', async () => {
        const repository = new MusicRepository(new Map(), undefined as never);
        repository.add(makeMusic('a'));

        const emitted: Array<{ event: string; payload: unknown }> = [];
        const emitter = new MusicEventEmitter((event, payload) => {
            emitted.push({ event, payload });
            return true;
        });

        const service = new MusicService(new AuthChecker(), makeResolver('b'), repository, emitter);

        const result = await service.addMusic({ url: 'https://youtu.be/b' });

        expect(result.ok).toBe(true);
        expect(emitted.some(e => e.event === 'queueReordered')).toBe(false);
    });
});
