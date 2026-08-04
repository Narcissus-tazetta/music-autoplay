import type { Music } from '@/shared/stores/musicStore';
import path from 'node:path';
import { JsonFileStore } from './jsonFileStore';
import type { PersistFile, Store } from './types';

const DEFAULT_FILE_PATH = path.resolve(
    process.cwd(),
    'data',
    'musicRequests.json',
);

const FLUSH_DELAY_MS = 500;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export class FileStore implements Store {
    private items: Music[] = [];
    private lastUpdated?: string;
    private readonly file: JsonFileStore<PersistFile>;

    constructor(filePath?: string) {
        this.file = new JsonFileStore<PersistFile>({
            filePath: filePath ?? DEFAULT_FILE_PATH,
            flushDelayMs: FLUSH_DELAY_MS,
            label: 'musicPersistence',
            onLoad: persisted => {
                this.items = persisted.items ?? [];
                this.lastUpdated = persisted.lastUpdated;
            },
            parse: raw => {
                const parsed = raw as PersistFile | undefined;
                const items = Array.isArray(parsed?.items) ? parsed.items : [];
                // A queue nobody touched for a week is stale; drop the items but keep the
                // timestamp so the next write records when it was last actually used.
                if (parsed?.lastUpdated) {
                    const last = new Date(parsed.lastUpdated).getTime();
                    if (Number.isFinite(last) && Date.now() - last > STALE_AFTER_MS)
                        return { items: [], lastUpdated: parsed.lastUpdated };
                }
                return { items, lastUpdated: parsed?.lastUpdated };
            },
            snapshot: () => ({ items: this.items, lastUpdated: this.lastUpdated }),
        });
    }

    private touch(): void {
        this.lastUpdated = new Date().toISOString();
        this.file.scheduleFlush();
    }

    load(): Music[] {
        this.file.ensureLoaded();
        return this.items;
    }

    addSync(m: Music, atIndex?: number) {
        this.file.ensureLoaded();
        const idx = this.items.findIndex(x => x.id === m.id);
        if (idx !== -1) this.items[idx] = m;
        else if (atIndex != undefined) this.items.splice(Math.max(0, Math.min(atIndex, this.items.length)), 0, m);
        else this.items.push(m);
        this.touch();
    }

    removeSync(id: string) {
        this.file.ensureLoaded();
        this.items = this.items.filter(x => x.id !== id);
        this.touch();
    }

    clearSync() {
        this.file.ensureLoaded();
        this.items = [];
        this.touch();
    }

    reorderSync(musics: Music[]) {
        this.file.ensureLoaded();
        this.items = musics;
        this.touch();
    }

    add(m: Music, atIndex?: number): void | Promise<void> {
        this.addSync(m, atIndex);
    }

    remove(id: string): void | Promise<void> {
        this.removeSync(id);
    }

    clear(): void {
        this.clearSync();
    }

    reorder(musics: Music[]): void | Promise<void> {
        this.reorderSync(musics);
    }

    // Both load first: writing a snapshot of never-hydrated state would clobber the file
    // on disk with an empty queue.
    async flush() {
        this.file.ensureLoaded();
        await this.file.flush();
    }

    closeSync() {
        this.file.ensureLoaded();
        this.file.closeSync();
    }
}
export default FileStore;
