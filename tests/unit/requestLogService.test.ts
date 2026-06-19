import { RequestLogFileStore } from '@/server/requestLog/requestLogFileStore';
import { RequestLogService, resetRequestLogService } from '@/server/requestLog/requestLogService';
import type { Music } from '@/shared/stores/musicStore';
import type { RequestLogEntry, RequestLogStore } from '@/shared/types/requestLog';
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
    requestedAt: new Date().toISOString(),
    requesterHash: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
    requesterName: '550e8400...',
    title: 'song-a',
    ...overrides,
});

const createService = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'request-log-test-'));
    tempDirs.push(dir);
    resetRequestLogService();
    return new RequestLogService(path.join(dir, 'request-logs.json'));
};

const createServiceWithPath = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'request-log-test-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'request-logs.json');
    resetRequestLogService();
    return { filePath, service: new RequestLogService(filePath) };
};

afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 450));
    await Promise.all(tempDirs.map(dir => fs.rm(dir, { force: true, recursive: true })));
    tempDirs = [];
    resetRequestLogService();
});

describe('RequestLogService', () => {
    test('appendFromMusic は requesterHash 付き Music を記録する', async () => {
        const service = await createService();
        const music = makeMusic();

        const entry = service.appendFromMusic(music);
        expect(entry).not.toBeNull();
        expect(entry?.title).toBe('song-a');
        expect(entry?.requesterHash).toBe(music.requesterHash);
    });

    test('appendFromMusic は requesterHash なしをスキップする', async () => {
        const service = await createService();
        const entry = service.appendFromMusic(makeMusic({ requesterHash: undefined }));
        expect(entry).toBeNull();
    });

    test('query は newest 順で limit 件を返す', async () => {
        const service = await createService();
        service.appendFromMusic(makeMusic({
            id: 'bbbbbbbbbbb',
            requestedAt: new Date(Date.now() - 60_000).toISOString(),
            title: 'older',
        }));
        service.appendFromMusic(makeMusic({
            id: 'ccccccccccc',
            requestedAt: new Date().toISOString(),
            title: 'newer',
        }));

        const rows = await service.query({ limit: 1 });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.title).toBe('newer');
    });

    test('query は requesterHash をマスクする', async () => {
        const service = await createService();
        service.appendFromMusic(makeMusic());

        const rows = await service.query();
        expect(rows[0]?.requesterHash).toBe('abc123de...');
    });

    test('query は hashPrefix でフィルタする', async () => {
        const service = await createService();
        service.appendFromMusic(makeMusic({
            id: 'ddddddddddd',
            requesterHash: 'aaa1111111111111111111111111111111111111111111111111111111111111',
            title: 'match',
        }));
        service.appendFromMusic(makeMusic({
            id: 'eeeeeeeeeee',
            requesterHash: 'bbb2222222222222222222222222222222222222222222222222222222222222',
            title: 'no-match',
        }));

        const rows = await service.query({ hashPrefix: 'aaa111' });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.title).toBe('match');
    });

    test('query は requesterHash 完全一致を prefix より優先する', async () => {
        const service = await createService();
        const exactHash = 'aaa1111111111111111111111111111111111111111111111111111111111111';
        service.appendFromMusic(makeMusic({
            id: 'ggggggggggg',
            requesterHash: exactHash,
            title: 'exact-match',
        }));
        service.appendFromMusic(makeMusic({
            id: 'hhhhhhhhhhh',
            requesterHash: 'aaa1112222222222222222222222222222222222222222222222222222222222',
            title: 'prefix-only',
        }));

        const rows = await service.query({ hashPrefix: 'aaa111', requesterHash: exactHash });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.title).toBe('exact-match');
    });

    test('30日より古いエントリは query から除外される', async () => {
        const service = await createService();
        const oldDate = new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)).toISOString();
        service.appendFromMusic(makeMusic({
            id: 'fffffffffff',
            requestedAt: oldDate,
            title: 'expired',
        }));

        const rows = await service.query();
        expect(rows).toHaveLength(0);
    });

    test('壊れた永続化データは query から除外する', async () => {
        const valid: RequestLogEntry = {
            id: 'valid-entry',
            musicId: 'aaaaaaaaaaa',
            requesterHash: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
            requesterName: '550e8400...',
            requestedAt: new Date().toISOString(),
            title: 'valid',
            url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
        };
        const store: RequestLogStore = {
            append: () => undefined,
            load: () => ({
                entries: [
                    valid,
                    { ...valid, id: '', title: 'broken-id' },
                    { ...valid, id: 'bad-date', requestedAt: 'not-a-date' },
                    { ...valid, id: 'bad-hash', requesterHash: 'guest' },
                ] as RequestLogEntry[],
            }),
        };
        const service = new RequestLogService(store);

        const rows = await service.query();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.title).toBe('valid');
    });

    test('store.query がある場合は query を委譲する', async () => {
        const valid: RequestLogEntry = {
            id: 'store-query-entry',
            musicId: 'aaaaaaaaaaa',
            requesterHash: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
            requesterName: '550e8400...',
            requestedAt: new Date().toISOString(),
            title: 'store-query',
            url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
        };
        let receivedLimit: number | undefined;
        const store: RequestLogStore = {
            append: () => undefined,
            load: () => ({ entries: [] }),
            query: input => {
                receivedLimit = input?.limit;
                return [valid];
            },
        };
        const service = new RequestLogService(store);

        const rows = await service.query({ limit: 25, requesterHash: valid.requesterHash });

        expect(receivedLimit).toBe(25);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.title).toBe('store-query');
    });

    test('flush は古いログをファイルから prune する', async () => {
        const { filePath, service } = await createServiceWithPath();
        const fresh = service.appendFromMusic(makeMusic({ id: 'iiiiiiiiiii', title: 'fresh' }));
        const old = service.appendFromMusic(makeMusic({
            id: 'jjjjjjjjjjj',
            requestedAt: new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)).toISOString(),
            title: 'old',
        }));

        expect(fresh).not.toBeNull();
        expect(old).not.toBeNull();
        await service.flush();

        const raw = await fs.readFile(filePath, 'utf8');
        const persisted = JSON.parse(raw) as { entries: RequestLogEntry[] };
        expect(persisted.entries.map(entry => entry.title)).toEqual(['fresh']);
    });

    test('RequestLogFileStore.replace は永続化対象を置き換える', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'request-log-store-test-'));
        tempDirs.push(dir);
        const filePath = path.join(dir, 'request-logs.json');
        const store = new RequestLogFileStore(filePath);
        const entry = {
            id: 'replace-entry',
            musicId: 'aaaaaaaaaaa',
            requesterHash: 'abc123def4567890abcdef1234567890abcdef1234567890abcdef1234567890',
            requesterName: '550e8400...',
            requestedAt: new Date().toISOString(),
            title: 'replace',
            url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
        };

        store.append({ ...entry, id: 'old-entry', title: 'old' });
        store.replace([entry]);
        await store.flush();

        const raw = await fs.readFile(filePath, 'utf8');
        const persisted = JSON.parse(raw) as { entries: RequestLogEntry[] };
        expect(persisted.entries).toHaveLength(1);
        expect(persisted.entries[0]?.title).toBe('replace');
    });
});
