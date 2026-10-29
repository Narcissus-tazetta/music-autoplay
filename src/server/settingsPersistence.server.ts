import { SERVER_ENV } from '@/server/env.server';
import path from 'node:path';
import { JsonFileStore } from './persistence/jsonFileStore';

const DEFAULT_FILE_PATH = path.resolve(SERVER_ENV.DATA_DIR ?? path.resolve(process.cwd(), 'data'), 'settings.json');
const FLUSH_DELAY_MS = 500;

interface StoredSettings {
    value: Record<string, unknown>;
    lastUpdated: string;
}

type PersistFile = Record<string, StoredSettings>;

/**
 * Per-user UI settings, on the same debounced, atomically-written file store the queue and
 * history use. It previously hand-rolled its own read/write pair and did a synchronous
 * whole-file rewrite inside the request handler.
 */
class SettingsStore {
    private entries: PersistFile = {};
    private readonly file: JsonFileStore<PersistFile>;

    constructor(filePath?: string) {
        this.file = new JsonFileStore<PersistFile>({
            filePath: filePath ?? DEFAULT_FILE_PATH,
            flushDelayMs: FLUSH_DELAY_MS,
            label: 'settingsPersistence',
            onLoad: persisted => {
                this.entries = persisted;
            },
            parse: raw => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as PersistFile : {}),
            snapshot: () => this.entries,
        });
    }

    load(userId: string): StoredSettings | undefined {
        this.file.ensureLoaded();
        return this.entries[userId];
    }

    save(userId: string, value: Record<string, unknown>): void {
        this.file.ensureLoaded();
        this.entries[userId] = { lastUpdated: new Date().toISOString(), value };
        this.file.scheduleFlush();
    }

    async flush(): Promise<void> {
        await this.file.flush();
    }

    closeSync(): void {
        this.file.closeSync();
    }
}

export const defaultSettingsStore = new SettingsStore();
