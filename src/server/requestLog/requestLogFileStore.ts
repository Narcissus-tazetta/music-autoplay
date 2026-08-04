import type {
    RequestLogEntry,
    RequestLogPersistFile,
    RequestLogQuery,
    RequestLogStore,
} from '@/shared/types/requestLog';
import path from 'node:path';
import { JsonFileStore } from '../persistence/jsonFileStore';

const DEFAULT_REQUEST_LOG_PATH = path.resolve(process.cwd(), 'data', 'request-logs.json');
const FLUSH_DELAY_MS = 400;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class RequestLogFileStore implements RequestLogStore {
    private readonly entries: RequestLogEntry[] = [];
    private readonly file: JsonFileStore<RequestLogPersistFile>;

    constructor(filePath?: string) {
        this.file = new JsonFileStore<RequestLogPersistFile>({
            filePath: filePath ?? DEFAULT_REQUEST_LOG_PATH,
            flushDelayMs: FLUSH_DELAY_MS,
            label: 'requestLogFileStore',
            onLoad: persisted => {
                this.entries.push(...persisted.entries);
            },
            parse: raw => {
                const parsed = raw as RequestLogPersistFile | undefined;
                const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
                return { entries, lastUpdated: parsed?.lastUpdated };
            },
            snapshot: () => ({
                entries: [...this.entries],
                lastUpdated: new Date().toISOString(),
            }),
        });
    }

    load(): RequestLogPersistFile {
        this.file.ensureLoaded();
        return { entries: [...this.entries] };
    }

    query(input?: RequestLogQuery): RequestLogEntry[] {
        this.file.ensureLoaded();
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
        this.file.ensureLoaded();
        this.entries.push(entry);
        this.file.scheduleFlush();
    }

    pruneExpired(now: Date): void {
        this.file.ensureLoaded();
        const cutoff = now.getTime() - RETENTION_MS;
        const next = this.entries.filter(entry => {
            const requestedAtMs = Date.parse(entry.requestedAt);
            return Number.isFinite(requestedAtMs) && requestedAtMs >= cutoff;
        });
        if (next.length === this.entries.length) return;
        this.entries.splice(0, this.entries.length, ...next);
        this.file.scheduleFlush();
    }

    replace(entries: RequestLogEntry[]): void {
        this.file.ensureLoaded();
        this.entries.splice(0, this.entries.length, ...entries);
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
