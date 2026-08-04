import { HistoryMongoHybridStore } from '@/server/history/historyMongoStore';
import type { HistoryItem } from '@/shared/types/history';
import { describe, expect, test } from 'bun:test';

const makeItem = (id: string, overrides?: Partial<HistoryItem>): HistoryItem => ({
    id,
    title: `title-${id}`,
    channelId: 'channel-1',
    channelName: 'channel',
    duration: 'PT3M',
    firstPlayedAt: '2026-03-01T10:00:00.000Z',
    lastPlayedAt: '2026-03-01T10:00:00.000Z',
    playCount: 1,
    ...overrides,
});

class MockHistoryMongoStore {
    public upserted: string[] = [];
    public removed: string[] = [];

    async upsert(item: HistoryItem): Promise<void> {
        this.upserted.push(item.id);
    }

    async remove(id: string): Promise<void> {
        this.removed.push(id);
    }
}

describe('HistoryMongoHybridStore', () => {
    test('upsert/removeをインメモリ状態とMongo書き込みに反映する', async () => {
        const mongo = new MockHistoryMongoStore();
        const store = new HistoryMongoHybridStore(mongo as never, [makeItem('a')]);

        store.upsert(makeItem('a', { playCount: 3 }));
        store.upsert(makeItem('b'));
        store.remove('a');
        await store.flush();

        expect(store.load().items.map(v => v.id)).toEqual(['b']);
        expect(mongo.upserted).toEqual(['a', 'b']);
        expect(mongo.removed).toEqual(['a']);
    });

    test('Mongo書き込みが全て失敗してもインメモリ状態は保たれる', async () => {
        const failing = {
            remove: () => Promise.reject(new Error('mongo down')),
            upsert: () => Promise.reject(new Error('mongo down')),
        };
        const store = new HistoryMongoHybridStore(failing as never, []);

        store.upsert(makeItem('a'));
        store.upsert(makeItem('b'));
        store.remove('a');

        // 失敗は握り潰される。flush は投げずに解決しなければならない。
        await expect(store.flush()).resolves.toBeUndefined();
        expect(store.load().items.map(v => v.id)).toEqual(['b']);
    });

    test('closeSync は保留中の書き込みを流し切り、例外を投げない', async () => {
        // プロセス終了時に走る経路。ここで throw すると履歴の書き込みが失われる。
        const mongo = new MockHistoryMongoStore();
        const store = new HistoryMongoHybridStore(mongo as never, []);

        store.upsert(makeItem('a'));
        expect(() => store.closeSync()).not.toThrow();

        await store.flush();
        expect(mongo.upserted).toEqual(['a']);
    });
});
