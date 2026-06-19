import type {
    RequestLogEntry,
    RequestLogPersistFile,
    RequestLogQuery,
    RequestLogStore,
} from '@/shared/types/requestLog';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../logger';

const DEFAULT_REQUEST_LOG_PATH = path.resolve(process.cwd(), 'data', 'request-logs.json');
const FLUSH_DELAY_MS = 400;

export class RequestLogFileStore implements RequestLogStore {
    private readonly filePath: string;
    private readonly entries: RequestLogEntry[] = [];
    private loaded = false;
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(filePath?: string) {
        this.filePath = filePath ?? DEFAULT_REQUEST_LOG_PATH;
    }

    private ensureDataDir(): void {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    private readFileSafe(): RequestLogPersistFile {
        try {
            if (!fs.existsSync(this.filePath)) return { entries: [] };
            const raw = fs.readFileSync(this.filePath, 'utf8');
            const parsed = JSON.parse(raw) as RequestLogPersistFile;
            const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
            return { entries, lastUpdated: parsed.lastUpdated };
        } catch (error) {
            logger.warn('requestLogFileStore read failed', { error });
            return { entries: [] };
        }
    }

    private ensureLoaded(): void {
        if (this.loaded) return;
        this.loaded = true;
        this.ensureDataDir();
        const persisted = this.readFileSafe();
        this.entries.push(...persisted.entries);
    }

    private scheduleFlush(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flush();
        }, FLUSH_DELAY_MS);
    }

    load(): RequestLogPersistFile {
        this.ensureLoaded();
        return { entries: [...this.entries] };
    }

    query(input?: RequestLogQuery): RequestLogEntry[] {
        this.ensureLoaded();
        const requesterHash = input?.requesterHash?.trim().toLowerCase();
        const hashPrefix = input?.hashPrefix?.trim().toLowerCase();
        const limit = input?.limit;
        let rows = [...this.entries];

        if (requesterHash) rows = rows.filter(entry => entry.requesterHash.toLowerCase() === requesterHash);
        else if (hashPrefix) rows = rows.filter(entry => entry.requesterHash.toLowerCase().startsWith(hashPrefix));

        rows.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
        return typeof limit === 'number' && Number.isFinite(limit) ? rows.slice(0, limit) : rows;
    }

    append(entry: RequestLogEntry): void {
        this.ensureLoaded();
        this.entries.push(entry);
        this.scheduleFlush();
    }

    pruneExpired(now: Date): void {
        this.ensureLoaded();
        const nowMs = now.getTime();
        const retentionMs = 30 * 24 * 60 * 60 * 1000;
        const next = this.entries.filter(entry => {
            const requestedAtMs = Date.parse(entry.requestedAt);
            return Number.isFinite(requestedAtMs) && requestedAtMs >= nowMs - retentionMs;
        });
        if (next.length === this.entries.length) return;
        this.entries.splice(0, this.entries.length, ...next);
        this.scheduleFlush();
    }

    replace(entries: RequestLogEntry[]): void {
        this.ensureLoaded();
        this.entries.splice(0, this.entries.length, ...entries);
        this.scheduleFlush();
    }

    async flush(): Promise<void> {
        this.ensureLoaded();
        try {
            this.ensureDataDir();
            const payload: RequestLogPersistFile = {
                entries: [...this.entries],
                lastUpdated: new Date().toISOString(),
            };
            const serialized = JSON.stringify(payload, undefined, 2);
            const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
            await fs.promises.writeFile(tmp, serialized, 'utf8');
            await fs.promises.rename(tmp, this.filePath);
        } catch (error) {
            logger.warn('requestLogFileStore flush failed', { error });
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
            const payload: RequestLogPersistFile = {
                entries: [...this.entries],
                lastUpdated: new Date().toISOString(),
            };
            const tmp = `${this.filePath}.${process.pid}.shutdown.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(payload, undefined, 2), 'utf8');
            fs.renameSync(tmp, this.filePath);
        } catch (error) {
            logger.warn('requestLogFileStore closeSync failed', { error });
        }
    }
}
