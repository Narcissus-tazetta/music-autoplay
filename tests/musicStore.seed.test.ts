import { useMusicStore } from '@/app/stores/musicStore';
import type { Music } from '@/shared/types/music';
import { beforeEach, describe, expect, test } from 'bun:test';

const music = (id: string): Music => ({
    channelId: 'cid',
    channelName: 'C',
    duration: '00:03:00',
    id,
    title: `title-${id}`,
});

describe('musicStore seedMusics', () => {
    beforeEach(() => {
        useMusicStore.setState({ hasServerSnapshot: false, musics: [] });
    });

    test('fills the queue while no socket snapshot has arrived', () => {
        useMusicStore.getState().seedMusics([music('a')]);

        expect(useMusicStore.getState().musics.map(m => m.id)).toEqual(['a']);
    });

    test('is ignored once the socket has delivered a snapshot', () => {
        useMusicStore.setState({ hasServerSnapshot: true, musics: [music('live')] });

        useMusicStore.getState().seedMusics([music('stale')]);

        expect(useMusicStore.getState().musics.map(m => m.id)).toEqual(['live']);
    });
});
