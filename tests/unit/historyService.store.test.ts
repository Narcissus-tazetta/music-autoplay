import { HistoryService } from '@/server/history/historyService';
import type { HistoryPersistFile, HistoryStore } from '@/server/history/historyStore';
import type { Music } from '@/shared/stores/musicStore';
import type { HistoryItem } from '@/shared/types/history';
import { describe, expect, test } from 'bun:test';

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

class InMemoryHistoryStore implements HistoryStore {
    private payload: HistoryPersistFile;
    public removedIds: string[] = [];

    constructor(items: HistoryItem[]) {
        this.payload = { items: [...items] };
    }

    load(): HistoryPersistFile {
        return { items: [...this.payload.items] };
    }

    upsert(item: HistoryItem): void {
        const idx = this.payload.items.findIndex(v => v.id === item.id);
        if (idx !== -1) this.payload.items[idx] = item;
        else this.payload.items.push(item);
    }

    remove(id: string): void {
        this.removedIds.push(id);
        this.payload.items = this.payload.items.filter(v => v.id !== id);
    }
}

describe('HistoryService store integration', () => {
    test('期限切れ履歴を読み込み時にstoreから削除する', () => {
        const oldIso = new Date(Date.now() - ((3 * 365 + 1) * 24 * 60 * 60 * 1000)).toISOString();
        const store = new InMemoryHistoryStore([
            {
                id: 'expired-id',
                title: 'expired',
                channelId: 'ch',
                channelName: 'expired-ch',
                duration: 'PT3M',
                firstPlayedAt: oldIso,
                lastPlayedAt: oldIso,
                playCount: 2,
            },
        ]);

        const service = new HistoryService(store);
        const rows = service.query();

        expect(rows).toEqual([]);
        expect(store.removedIds).toEqual(['expired-id']);
    });

    test('store注入時もrecordPlayedが集約動作する', () => {
        const store = new InMemoryHistoryStore([]);
        const service = new HistoryService(store);

        service.recordPlayed(makeMusic({ id: 'aaaaaaaaaaa' }), '2026-03-01T10:00:00.000Z');
        const updated = service.recordPlayed(makeMusic({ id: 'aaaaaaaaaaa' }), '2026-03-01T11:00:00.000Z');

        expect(updated.playCount).toBe(2);
        expect(store.load().items).toHaveLength(1);
        expect(store.load().items[0]?.playCount).toBe(2);
    });

    test('不正なmusic payloadは保存しない', () => {
        const store = new InMemoryHistoryStore([]);
        const service = new HistoryService(store);

        expect(() => {
            service.recordPlayed(makeMusic({ id: 'bad id', title: '   ' }));
        }).toThrow('historyService: invalid music payload');

        expect(store.load().items).toHaveLength(0);
    });
});
