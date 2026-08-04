import type { HistoryItem } from '@/shared/types/history';
import path from 'node:path';
import { JsonFileStore } from '../persistence/jsonFileStore';
import type { HistoryPersistFile, HistoryStore } from './historyStore';

const DEFAULT_HISTORY_PATH = path.resolve(process.cwd(), 'data', 'history.json');
const FLUSH_DELAY_MS = 400;

export class HistoryFileStore implements HistoryStore {
    private readonly itemsById = new Map<string, HistoryItem>();
    private readonly file: JsonFileStore<HistoryPersistFile>;

    constructor(filePath?: string) {
        this.file = new JsonFileStore<HistoryPersistFile>({
            filePath: filePath ?? DEFAULT_HISTORY_PATH,
            flushDelayMs: FLUSH_DELAY_MS,
            label: 'historyFileStore',
            onLoad: persisted => {
                for (const item of persisted.items) this.itemsById.set(item.id, item);
            },
            parse: raw => {
                const parsed = raw as HistoryPersistFile | undefined;
                const items = Array.isArray(parsed?.items) ? parsed.items : [];
                return { items, lastUpdated: parsed?.lastUpdated };
            },
            snapshot: () => ({
                items: [...this.itemsById.values()],
                lastUpdated: new Date().toISOString(),
            }),
        });
    }

    load(): HistoryPersistFile {
        this.file.ensureLoaded();
        return { items: [...this.itemsById.values()] };
    }

    upsert(item: HistoryItem): void {
        this.file.ensureLoaded();
        this.itemsById.set(item.id, item);
        this.file.scheduleFlush();
    }

    remove(id: string): void {
        this.file.ensureLoaded();
        if (!this.itemsById.delete(id)) return;
        this.file.scheduleFlush();
    }

    async flush(): Promise<void> {
        this.file.ensureLoaded();
        await this.file.flush();
    }

    closeSync(): void {
        this.file.ensureLoaded();
        this.file.closeSync();
    }
}
