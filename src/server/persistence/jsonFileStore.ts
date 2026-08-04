import logger from '@/server/logger';
import fs from 'node:fs';
import path from 'node:path';

const MAX_WRITE_RETRIES = 5;
const WRITE_BACKOFF_BASE_MS = 200;

export interface JsonFileStoreOptions<T> {
    filePath: string;
    /** Debounce window between a mutation and the write that persists it. */
    flushDelayMs: number;
    /** Prefix for this store's warn logs, e.g. `historyFileStore`. */
    label: string;
    /**
     * Coerces the parsed JSON into a valid payload. Called with `undefined` when the file is
     * missing or unreadable, so it doubles as the empty-value factory.
     */
    parse: (raw: unknown) => T;
    /** Hydrates the owner's in-memory state from the payload just read off disk. */
    onLoad: (payload: T) => void;
    /** Builds the payload to write from the owner's current in-memory state. */
    snapshot: () => T;
}

/**
 * The debounced, atomically-written JSON file backing FileStore, HistoryFileStore and
 * RequestLogFileStore. Each owner keeps its own in-memory shape and query methods and
 * delegates the disk mechanics — lazy load, flush scheduling, atomic replace — here.
 *
 * Writes go to a temp file and are renamed into place, so a crash mid-write leaves the
 * previous contents intact rather than a truncated file.
 */
export class JsonFileStore<T> {
    private flushTimer: NodeJS.Timeout | null = null;
    private loaded = false;

    constructor(private readonly opts: JsonFileStoreOptions<T>) {}

    private ensureDataDir(): void {
        const dir = path.dirname(this.opts.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    private read(): T {
        try {
            if (!fs.existsSync(this.opts.filePath)) return this.opts.parse(undefined);
            const raw = fs.readFileSync(this.opts.filePath, 'utf8');
            return this.opts.parse(JSON.parse(raw));
        } catch (error) {
            logger.warn(`${this.opts.label}: failed to read file`, { error });
            return this.opts.parse(undefined);
        }
    }

    /** Reads the file the first time it is called; subsequent calls are no-ops. */
    ensureLoaded(): void {
        if (this.loaded) return;
        this.loaded = true;
        this.ensureDataDir();
        this.opts.onLoad(this.read());
    }

    scheduleFlush(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flush();
        }, this.opts.flushDelayMs);
    }

    private cancelScheduledFlush(): void {
        if (!this.flushTimer) return;
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
    }

    /** Writes the current snapshot, retrying with exponential backoff before giving up. */
    async flush(): Promise<void> {
        // Load first: writing a snapshot of never-hydrated state would clobber the file on
        // disk with an empty payload. Every owner used to repeat this call by hand.
        this.ensureLoaded();
        this.cancelScheduledFlush();
        const payload = JSON.stringify(this.opts.snapshot(), undefined, 2);
        const tmpBase = `${this.opts.filePath}.${process.pid}`;

        for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt++) {
            const tmp = `${tmpBase}.${Date.now()}.tmp`;
            try {
                // Sequential by design: the rename must observe the finished temp file.
                // eslint-disable-next-line no-await-in-loop
                await fs.promises.writeFile(tmp, payload, 'utf8');
                // eslint-disable-next-line no-await-in-loop
                await fs.promises.rename(tmp, this.opts.filePath);
                return;
            } catch (error) {
                try {
                    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
                } catch (cleanupError) {
                    logger.warn(`${this.opts.label}: failed to remove tmp file`, { error: cleanupError });
                }
                const backoff = WRITE_BACKOFF_BASE_MS * Math.pow(2, attempt);
                logger.warn(
                    `${this.opts.label}: write attempt ${attempt + 1} failed, retrying in ${backoff}ms`,
                    { error },
                );
                // eslint-disable-next-line no-await-in-loop
                await new Promise(r => setTimeout(r, backoff));
            }
        }
        logger.warn(`${this.opts.label}: failed to write file after retries`);
    }

    /** Best-effort synchronous write for process exit, where promises no longer run. */
    closeSync(): void {
        this.ensureLoaded();
        this.cancelScheduledFlush();
        try {
            this.ensureDataDir();
            const tmp = `${this.opts.filePath}.${process.pid}.shutdown.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(this.opts.snapshot(), undefined, 2), 'utf8');
            fs.renameSync(tmp, this.opts.filePath);
        } catch (error) {
            logger.warn(`${this.opts.label}: failed to flush sync on exit`, { error });
        }
    }
}
