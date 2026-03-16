import type { HistoryItem } from '@/shared/types/history';

export interface HistoryPersistFile {
    items: HistoryItem[];
    lastUpdated?: string;
}

export interface HistoryStore {
    load(): HistoryPersistFile;
    upsert(item: HistoryItem): void | Promise<void>;
    remove(id: string): void | Promise<void>;
    flush?(): Promise<void>;
    closeSync?(): void;
}
