import { SERVER_ENV } from '@/server/env.server';
import path from 'node:path';
import { JsonFileStore } from './persistence/jsonFileStore';

const DEFAULT_FILE_PATH = path.resolve(SERVER_ENV.DATA_DIR ?? path.resolve(process.cwd(), 'data'), 'settings.json');
const FLUSH_DELAY_MS = 500;

export interface StoredSettings {
    value: Record<string, unknown>;
    lastUpdated: string;
}

/** Per-user UI settings. The backend is chosen by PERSISTENCE_PROVIDER, like the queue and history. */
export interface SettingsStore {
    load(userId: string): StoredSettings | undefined;
    save(userId: string, value: Record<string, unknown>): void;
    flush(): Promise<void>;
    closeSync(): void;
}

type PersistFile = Record<string, StoredSettings>;

export class FileSettingsStore implements SettingsStore {
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

let settingsStoreSingleton: SettingsStore | undefined;

export function setSettingsStore(store: SettingsStore): void {
    settingsStoreSingleton = store;
}

export function getSettingsStore(): SettingsStore {
    if (!settingsStoreSingleton) settingsStoreSingleton = new FileSettingsStore();
    return settingsStoreSingleton;
}
