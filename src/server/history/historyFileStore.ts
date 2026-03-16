import type { HistoryItem } from '@/shared/types/history';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../logger';
import type { HistoryPersistFile, HistoryStore } from './historyStore';

const DEFAULT_HISTORY_PATH = path.resolve(process.cwd(), 'data', 'history.json');
const FLUSH_DELAY_MS = 400;

export class HistoryFileStore implements HistoryStore {
    private readonly filePath: string;
    private readonly itemsById = new Map<string, HistoryItem>();
    private loaded = false;
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(filePath?: string) {
        this.filePath = filePath ?? DEFAULT_HISTORY_PATH;
    }

    private ensureDataDir(): void {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    private readFileSafe(): HistoryPersistFile {
        try {
            if (!fs.existsSync(this.filePath)) return { items: [] };
            const raw = fs.readFileSync(this.filePath, 'utf8');
            const parsed = JSON.parse(raw) as HistoryPersistFile;
            const items = Array.isArray(parsed.items) ? parsed.items : [];
            return { items, lastUpdated: parsed.lastUpdated };
        } catch (error) {
            logger.warn('historyFileStore read failed', { error });
            return { items: [] };
        }
    }

    private ensureLoaded(): void {
        if (this.loaded) return;
        this.loaded = true;
        this.ensureDataDir();
        const persisted = this.readFileSafe();
        for (const item of persisted.items) this.itemsById.set(item.id, item);
    }

    private scheduleFlush(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flush();
        }, FLUSH_DELAY_MS);
    }

    load(): HistoryPersistFile {
        this.ensureLoaded();
        return {
            items: [...this.itemsById.values()],
        };
    }

    upsert(item: HistoryItem): void {
        this.ensureLoaded();
        this.itemsById.set(item.id, item);
        this.scheduleFlush();
    }

    remove(id: string): void {
        this.ensureLoaded();
        if (!this.itemsById.delete(id)) return;
        this.scheduleFlush();
    }

    async flush(): Promise<void> {
        this.ensureLoaded();
        try {
            this.ensureDataDir();
            const payload: HistoryPersistFile = {
                items: [...this.itemsById.values()],
                lastUpdated: new Date().toISOString(),
            };
            const serialized = JSON.stringify(payload, undefined, 2);
            const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
            await fs.promises.writeFile(tmp, serialized, 'utf8');
            await fs.promises.rename(tmp, this.filePath);
        } catch (error) {
            logger.warn('historyFileStore flush failed', { error });
        }
    }

    closeSync(): void {
        this.ensureLoaded();
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        try {
            this.ensureDataDir();
            const payload: HistoryPersistFile = {
                items: [...this.itemsById.values()],
                lastUpdated: new Date().toISOString(),
            };
            const tmp = `${this.filePath}.${process.pid}.shutdown.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(payload, undefined, 2), 'utf8');
            fs.renameSync(tmp, this.filePath);
        } catch (error) {
            logger.warn('historyFileStore closeSync failed', { error });
        }
    }
}
