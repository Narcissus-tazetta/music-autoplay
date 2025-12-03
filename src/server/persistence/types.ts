import type { Music } from '@/shared/stores/musicStore';

export interface PersistFile {
    items?: Music[];
    lastUpdated?: string;
}

export interface Store {
    load(): Music[];
    add(m: Music): void | Promise<void>;
    remove(id: string): void | Promise<void>;
    clear(): void;
    flush?(): Promise<void>;
    closeSync?(): void;
}
