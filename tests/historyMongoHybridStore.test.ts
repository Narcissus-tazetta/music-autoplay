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
});
