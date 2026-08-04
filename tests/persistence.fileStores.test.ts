import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { HistoryFileStore } from '../src/server/history/historyFileStore';
import FileStore from '../src/server/persistence/file';
import { RequestLogFileStore } from '../src/server/requestLog/requestLogFileStore';
import { afterEach, beforeEach, describe, expect, it } from './bunTestCompat';

/**
 * Round-trip coverage for the three JSON file stores after they were moved onto the shared
 * JsonFileStore helper. The point of these tests is the read path: a regression there
 * silently discards whatever was already on disk, so each store is pointed at a file
 * containing realistic pre-existing data and asked to preserve it.
 */

let dir: string;
const at = (name: string) => path.join(dir, name);
const writeJson = (name: string, value: unknown) => fs.writeFileSync(at(name), JSON.stringify(value, undefined, 2));
const readJson = (name: string) => JSON.parse(fs.readFileSync(at(name), 'utf8'));

const music = (id: string, title = id) => ({
    channelId: `ch-${id}`,
    channelName: 'Channel',
    duration: '00:03:50',
    id,
    requestedAt: '2026-08-01T00:00:00.000Z',
    requesterHash: 'hash',
    requesterName: 'guest',
    title,
});

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapfilestore-'));
});

afterEach(() => {
    fs.rmSync(dir, { force: true, recursive: true });
});

describe('FileStore', () => {
    it('loads items that already exist on disk', () => {
        writeJson('m.json', {
            items: [music('aaa11111111'), music('bbb22222222')],
            lastUpdated: new Date().toISOString(),
        });

        const loaded = new FileStore(at('m.json')).load();

        expect(loaded.map(m => m.id)).toEqual(['aaa11111111', 'bbb22222222']);
        expect(loaded[0].title).toBe('aaa11111111');
        expect(loaded[0].channelId).toBe('ch-aaa11111111');
    });

    it('preserves existing entries when a new one is added and flushed', async () => {
        writeJson('m.json', { items: [music('aaa11111111')], lastUpdated: new Date().toISOString() });

        const store = new FileStore(at('m.json'));
        store.add(music('bbb22222222'));
        await store.flush();

        expect(readJson('m.json').items.map((m: { id: string }) => m.id))
            .toEqual(['aaa11111111', 'bbb22222222']);
    });

    it('honours the insert index and persists the resulting order', async () => {
        const store = new FileStore(at('m.json'));
        store.add(music('aaa11111111'));
        store.add(music('bbb22222222'));
        store.add(music('ccc33333333'), 1);
        await store.flush();

        expect(readJson('m.json').items.map((m: { id: string }) => m.id))
            .toEqual(['aaa11111111', 'ccc33333333', 'bbb22222222']);
    });

    it('replaces an existing entry rather than duplicating it', async () => {
        const store = new FileStore(at('m.json'));
        store.add(music('aaa11111111', 'first'));
        store.add(music('aaa11111111', 'second'));
        await store.flush();

        const items = readJson('m.json').items;
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('second');
    });

    it('persists reorder', async () => {
        const store = new FileStore(at('m.json'));
        store.add(music('aaa11111111'));
        store.add(music('bbb22222222'));
        store.reorder([music('bbb22222222'), music('aaa11111111')]);
        await store.flush();

        expect(readJson('m.json').items.map((m: { id: string }) => m.id))
            .toEqual(['bbb22222222', 'aaa11111111']);
    });

    it('drops a queue that has been untouched for over a week', () => {
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
        writeJson('m.json', { items: [music('aaa11111111')], lastUpdated: eightDaysAgo });

        expect(new FileStore(at('m.json')).load()).toEqual([]);
    });

    it('keeps a queue that was touched within the week', () => {
        const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
        writeJson('m.json', { items: [music('aaa11111111')], lastUpdated: sixDaysAgo });

        expect(new FileStore(at('m.json')).load()).toHaveLength(1);
    });

    it('survives a corrupt file instead of throwing', () => {
        fs.writeFileSync(at('m.json'), '{ this is not json');
        expect(new FileStore(at('m.json')).load()).toEqual([]);
    });

    it('closeSync does not clobber the file when nothing was ever loaded', () => {
        writeJson('m.json', { items: [music('aaa11111111')], lastUpdated: new Date().toISOString() });

        // A store constructed during shutdown must not write an empty snapshot over real data.
        new FileStore(at('m.json')).closeSync();

        expect(readJson('m.json').items).toHaveLength(1);
    });

    it('creates the data directory when it does not exist yet', async () => {
        const nested = path.join(dir, 'deep', 'nested', 'm.json');
        const store = new FileStore(nested);
        store.add(music('aaa11111111'));
        await store.flush();

        expect(fs.existsSync(nested)).toBe(true);
    });
});

describe('HistoryFileStore', () => {
    const item = (id: string, playCount = 1) => ({
        channelId: `ch-${id}`,
        channelName: 'Channel',
        duration: '00:03:50',
        firstPlayedAt: '2026-03-12T06:42:31.652Z',
        id,
        lastPlayedAt: '2026-03-12T06:42:31.652Z',
        playCount,
        title: `title-${id}`,
    });

    it('loads items that already exist on disk', () => {
        writeJson('h.json', { items: [item('aGSmxr-dUq0'), item('zzz11111111')] });

        const loaded = new HistoryFileStore(at('h.json')).load();

        expect(loaded.items.map(i => i.id).toSorted()).toEqual(['aGSmxr-dUq0', 'zzz11111111']);
    });

    it('upsert merges by id and preserves existing entries through a flush', async () => {
        writeJson('h.json', { items: [item('aaa11111111', 1)] });

        const store = new HistoryFileStore(at('h.json'));
        store.upsert({ ...item('aaa11111111', 5) });
        store.upsert({ ...item('bbb22222222') });
        await store.flush();

        const items = readJson('h.json').items;
        expect(items).toHaveLength(2);
        expect(items.find((i: { id: string }) => i.id === 'aaa11111111').playCount).toBe(5);
    });

    it('remove deletes only the targeted entry', async () => {
        writeJson('h.json', { items: [item('aaa11111111'), item('bbb22222222')] });

        const store = new HistoryFileStore(at('h.json'));
        store.remove('aaa11111111');
        await store.flush();

        expect(readJson('h.json').items.map((i: { id: string }) => i.id)).toEqual(['bbb22222222']);
    });

    it('closeSync preserves data loaded from disk', () => {
        writeJson('h.json', { items: [item('aaa11111111')] });

        new HistoryFileStore(at('h.json')).closeSync();

        expect(readJson('h.json').items).toHaveLength(1);
    });
});

describe('RequestLogFileStore', () => {
    const entry = (id: string, requestedAt: string, requesterHash = 'abc123') => ({
        id,
        musicId: `music-${id}`,
        requestedAt,
        requesterHash,
        requesterName: 'guest',
        title: `title-${id}`,
        url: `https://www.youtube.com/watch?v=${id}`,
    });

    const now = new Date('2026-08-04T00:00:00.000Z');
    const recent = '2026-08-01T00:00:00.000Z';
    const ancient = '2026-01-01T00:00:00.000Z';

    it('loads entries that already exist on disk', () => {
        writeJson('r.json', { entries: [entry('a', recent), entry('b', recent)] });

        expect(new RequestLogFileStore(at('r.json')).load().entries.map(e => e.id)).toEqual(['a', 'b']);
    });

    it('append preserves existing entries through a flush', async () => {
        writeJson('r.json', { entries: [entry('a', recent)] });

        const store = new RequestLogFileStore(at('r.json'));
        store.append(entry('b', recent));
        await store.flush();

        expect(readJson('r.json').entries.map((e: { id: string }) => e.id)).toEqual(['a', 'b']);
    });

    it('query filters by requesterHash and sorts newest first', () => {
        writeJson('r.json', {
            entries: [
                entry('old', '2026-08-01T00:00:00.000Z', 'AAA'),
                entry('new', '2026-08-03T00:00:00.000Z', 'aaa'),
                entry('other', recent, 'bbb'),
            ],
        });

        const rows = new RequestLogFileStore(at('r.json')).query({ requesterHash: 'aaa' });

        expect(rows.map(r => r.id)).toEqual(['new', 'old']);
    });

    it('query filters by hash prefix and honours the limit', () => {
        writeJson('r.json', {
            entries: [entry('a', recent, 'abc123'), entry('b', recent, 'abcdef'), entry('c', recent, 'zzz')],
        });

        const store = new RequestLogFileStore(at('r.json'));
        expect(store.query({ hashPrefix: 'abc' })).toHaveLength(2);
        expect(store.query({ hashPrefix: 'abc', limit: 1 })).toHaveLength(1);
    });

    it('pruneExpired drops entries past the 30 day retention and keeps the rest', async () => {
        writeJson('r.json', { entries: [entry('keep', recent), entry('drop', ancient)] });

        const store = new RequestLogFileStore(at('r.json'));
        store.pruneExpired(now);
        await store.flush();

        expect(readJson('r.json').entries.map((e: { id: string }) => e.id)).toEqual(['keep']);
    });

    it('closeSync preserves data loaded from disk', () => {
        writeJson('r.json', { entries: [entry('a', recent)] });

        new RequestLogFileStore(at('r.json')).closeSync();

        expect(readJson('r.json').entries).toHaveLength(1);
    });
});

describe('real on-disk data round-trips unchanged', () => {
    const cases: [string, string, (p: string) => unknown][] = [
        ['data/history.json', 'h.json', p => new HistoryFileStore(p).load()],
        ['data/request-logs.json', 'r.json', p => new RequestLogFileStore(p).load()],
    ];

    for (const [source, name, load] of cases) {
        it(`preserves every record in ${source}`, async () => {
            if (!fs.existsSync(source)) return; // nothing to check on a fresh clone
            const original = JSON.parse(fs.readFileSync(source, 'utf8'));
            fs.copyFileSync(source, at(name));

            const before = load(at(name));
            expect(before).toBeDefined();

            // Read it, write it back out, and read it again: nothing may be lost in the cycle.
            const store = name === 'h.json' ? new HistoryFileStore(at(name)) : new RequestLogFileStore(at(name));
            store.load();
            await store.flush();

            const rewritten = readJson(name);
            const key = name === 'h.json' ? 'items' : 'entries';
            expect(rewritten[key]).toHaveLength(original[key].length);
            expect(rewritten[key]).toEqual(original[key]);
        });
    }
});
