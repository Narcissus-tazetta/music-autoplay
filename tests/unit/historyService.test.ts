import { HistoryService } from '@/server/history/historyService';
import type { Music } from '@/shared/stores/musicStore';
import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let tempDirs: string[] = [];

const makeMusic = (overrides?: Partial<Music>): Music => ({
    channelId: 'channel-1',
    channelName: 'channel name',
    duration: 'PT3M',
    id: 'aaaaaaaaaaa',
    requestedAt: '2026-03-01T00:00:00.000Z',
    requesterHash: 'hash',
    requesterName: 'guest',
    title: 'song-a',
    ...overrides,
});

const createService = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'history-service-test-'));
    tempDirs.push(dir);
    return new HistoryService(path.join(dir, 'history.json'));
};

afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 450));
    await Promise.all(tempDirs.map(dir => fs.rm(dir, { force: true, recursive: true })));
    tempDirs = [];
});

describe('HistoryService', () => {
    test('recordPlayed は同一IDを集約して再生回数を増やす', async () => {
        const service = await createService();

        service.recordPlayed(makeMusic(), '2026-03-01T10:00:00.000Z');
        const updated = service.recordPlayed(
            makeMusic({ title: 'song-a-updated' }),
            '2026-03-01T11:00:00.000Z',
        );

        expect(updated.playCount).toBe(2);
        expect(updated.title).toBe('song-a-updated');
        expect(updated.firstPlayedAt).toBe('2026-03-01T10:00:00.000Z');
        expect(updated.lastPlayedAt).toBe('2026-03-01T11:00:00.000Z');
    });

    test('query は newest / oldest / mostPlayed で正しく並び替える', async () => {
        const service = await createService();

        service.recordPlayed(makeMusic({ id: 'aaaaaaaaaaa', title: 'A' }), '2026-03-01T10:00:00.000Z');
        service.recordPlayed(makeMusic({ id: 'bbbbbbbbbbb', title: 'B' }), '2026-03-01T11:00:00.000Z');
        service.recordPlayed(makeMusic({ id: 'ccccccccccc', title: 'C' }), '2026-03-01T12:00:00.000Z');
        service.recordPlayed(makeMusic({ id: 'bbbbbbbbbbb', title: 'B' }), '2026-03-01T13:00:00.000Z');

        const newest = service.query({ sort: 'newest' });
        const oldest = service.query({ sort: 'oldest' });
        const mostPlayed = service.query({ sort: 'mostPlayed' });

        expect(newest.map(v => v.id)).toEqual(['bbbbbbbbbbb', 'ccccccccccc', 'aaaaaaaaaaa']);
        expect(oldest.map(v => v.id)).toEqual(['aaaaaaaaaaa', 'ccccccccccc', 'bbbbbbbbbbb']);
        expect(mostPlayed.map(v => v.id)[0]).toBe('bbbbbbbbbbb');
    });

    test('query は query / from / to フィルタを適用する', async () => {
        const service = await createService();

        service.recordPlayed(
            makeMusic({ channelName: 'alpha ch', id: 'aaaaaaaaaaa', title: 'alpha song' }),
            '2026-03-01T10:00:00.000Z',
        );
        service.recordPlayed(
            makeMusic({ channelName: 'beta ch', id: 'bbbbbbbbbbb', title: 'beta song' }),
            '2026-03-03T10:00:00.000Z',
        );
        service.recordPlayed(
            makeMusic({ channelName: 'gamma ch', id: 'ccccccccccc', title: 'gamma song' }),
            '2026-03-05T10:00:00.000Z',
        );

        const byQuery = service.query({ query: 'beta' });
        const byFrom = service.query({ from: '2026-03-03' });
        const byTo = service.query({ to: '2026-03-03' });

        expect(byQuery.map(v => v.id)).toEqual(['bbbbbbbbbbb']);
        expect(byFrom.map(v => v.id)).toEqual(['ccccccccccc', 'bbbbbbbbbbb']);
        expect(byTo.map(v => v.id)).toEqual(['bbbbbbbbbbb', 'aaaaaaaaaaa']);
    });
});
