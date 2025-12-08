import logger from '@/server/logger';
import type { Music } from '@/shared/stores/musicStore';
import fs from 'node:fs';
import path from 'node:path';
import type { PersistFile, Store } from './types';

const DEFAULT_FILE_PATH = path.resolve(
    process.cwd(),
    'data',
    'musicRequests.json',
);

const MAX_WRITE_RETRIES = 5;
const WRITE_BACKOFF_BASE_MS = 200;
const FLUSH_DELAY_MS = 500;

export class FileStore implements Store {
    private filePath: string;
    private current: PersistFile | null = null;
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(filePath?: string) {
        this.filePath = filePath ?? DEFAULT_FILE_PATH;
        this.ensureDataDir();
    }

    private ensureDataDir() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    private readFileSafeSync(): PersistFile {
        try {
            if (!fs.existsSync(this.filePath)) return { items: [] };
            const raw = fs.readFileSync(this.filePath, 'utf8');
            const parsed = JSON.parse(raw) as PersistFile;
            if (parsed.lastUpdated) {
                const last = new Date(parsed.lastUpdated).getTime();
                if (
                    Number.isFinite(last)
                    && Date.now() - last > 7 * 24 * 60 * 60 * 1000
                ) {
                    return { items: [], lastUpdated: parsed.lastUpdated };
                }
            }

            return parsed;
        } catch (error) {
            logger.warn('musicPersistence: failed to read file', {
                error: error,
            });
            return { items: [] };
        }
    }

    private async writeFileAtomicAsync(obj: unknown) {
        const payload = JSON.stringify(obj, undefined, 2);
        const tmpBase = `${this.filePath}.${process.pid}`;

        for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt++) {
            const tmp = `${tmpBase}.${Date.now()}.tmp`;
            try {
                // writeFile/rename are intentionally awaited sequentially; disable rule here
                // eslint-disable-next-line no-await-in-loop
                await fs.promises.writeFile(tmp, payload, 'utf8');
                // eslint-disable-next-line no-await-in-loop
                await fs.promises.rename(tmp, this.filePath);
                return;
            } catch (error) {
                try {
                    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
                } catch (error) {
                    logger.warn('musicPersistence: failed to remove tmp file', {
                        error: error,
                    });
                }
                const backoff = WRITE_BACKOFF_BASE_MS * Math.pow(2, attempt);
                logger.warn(
                    `musicPersistence: write attempt ${attempt + 1} failed, retrying in ${backoff}ms`,
                    {
                        error: error,
                    },
                );
                // eslint-disable-next-line no-await-in-loop
                await new Promise(r => setTimeout(r, backoff));
            }
        }
        throw new Error('musicPersistence: failed to write file after retries');
    }

    private async flushToDisk() {
        if (!this.current) return;
        try {
            await this.writeFileAtomicAsync(this.current);
        } catch (error) {
            logger.warn('musicPersistence: failed to flush to disk', {
                error: error,
            });
            setTimeout(() => {
                void this.flushToDisk();
            }, WRITE_BACKOFF_BASE_MS);
        }
    }

    private scheduleFlush() {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flushToDisk();
        }, FLUSH_DELAY_MS);
    }

    load(): Music[] {
        if (this.current) {
            this.current.items = this.current.items || [];
            return this.current.items;
        }
        this.current = this.readFileSafeSync();
        this.current.items = this.current.items || [];
        return this.current.items;
    }

    addSync(m: Music) {
        if (!this.current) this.current = this.readFileSafeSync();
        this.current.items = this.current.items || [];
        const idx = this.current.items.findIndex(x => x.id === m.id);
        if (idx !== -1) this.current.items[idx] = m;
        else this.current.items.push(m);
        this.current.lastUpdated = new Date().toISOString();
        this.scheduleFlush();
    }

    removeSync(id: string) {
        if (!this.current) this.current = this.readFileSafeSync();
        this.current.items = (this.current.items || []).filter(x => x.id !== id);
        this.current.lastUpdated = new Date().toISOString();
        this.scheduleFlush();
    }
    clearSync() {
        this.current = { items: [], lastUpdated: new Date().toISOString() };
        this.scheduleFlush();
    }

    add(m: Music): void | Promise<void> {
        this.addSync(m);
    }

    remove(id: string): void | Promise<void> {
        this.removeSync(id);
    }

    clear(): void {
        this.clearSync();
    }

    async flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flushToDisk();
    }

    closeSync() {
        if (!this.current) return;
        try {
            const tmp = `${this.filePath}.${process.pid}.shutdown.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(this.current, undefined, 2), 'utf8');
            fs.renameSync(tmp, this.filePath);
        } catch (error) {
            logger.warn('musicPersistence: failed to flush sync on exit', {
                error: error,
            });
        }
    }
}

export const defaultFileStore = new FileStore();

export default FileStore;
