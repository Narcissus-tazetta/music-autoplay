import { maskRequesterHash } from '@/server/requesterIdentity.server';
import type { Music } from '@/shared/types/music';
import type {
    MaskedRequestLogEntry,
    RequestLogEntry,
    RequestLogQuery,
    RequestLogStore,
} from '@/shared/types/requestLog';
import { watchUrl } from '@/shared/utils/youtube';
import { randomUUID } from 'node:crypto';
import logger from '../logger.server';
import { RequestLogFileStore } from './requestLogFileStore';

const REQUEST_LOG_RETENTION_DAYS = 30;
const REQUEST_LOG_RETENTION_MS = REQUEST_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const MUSIC_ID_PATTERN = /^[A-Za-z0-9_-]{11,20}$/;
const DEFAULT_LIMIT = 50;

function isValidRequesterHash(value: unknown): value is string {
    return typeof value === 'string' && (HASH_PATTERN.test(value) || value === 'external');
}

function normalizeEntry(input: unknown): RequestLogEntry | null {
    if (!input || typeof input !== 'object') return null;
    const entry = input as Partial<RequestLogEntry>;

    if (typeof entry.id !== 'string' || entry.id.length === 0) return null;
    if (!isValidRequesterHash(entry.requesterHash)) return null;
    if (typeof entry.musicId !== 'string' || !MUSIC_ID_PATTERN.test(entry.musicId)) return null;
    if (typeof entry.title !== 'string' || entry.title.trim().length === 0) return null;
    if (typeof entry.url !== 'string' || entry.url.trim().length === 0) return null;
    if (typeof entry.requestedAt !== 'string') return null;
    const requestedAtMs = Date.parse(entry.requestedAt);
    if (!Number.isFinite(requestedAtMs)) return null;

    return {
        id: entry.id,
        musicId: entry.musicId.trim(),
        requesterHash: entry.requesterHash,
        requesterName: typeof entry.requesterName === 'string' && entry.requesterName.trim().length > 0
            ? entry.requesterName.trim()
            : 'guest',
        requestedAt: new Date(requestedAtMs).toISOString(),
        title: entry.title.trim(),
        url: entry.url.trim(),
    };
}

function isWithinRetention(entry: RequestLogEntry, nowMs: number): boolean {
    const requestedAtMs = Date.parse(entry.requestedAt);
    return Number.isFinite(requestedAtMs) && requestedAtMs >= nowMs - REQUEST_LOG_RETENTION_MS;
}

function maskEntry(entry: RequestLogEntry): MaskedRequestLogEntry {
    return {
        ...entry,
        requesterHash: maskRequesterHash(entry.requesterHash),
    };
}

export class RequestLogService {
    private readonly store: RequestLogStore;

    constructor(filePathOrStore?: string | RequestLogStore) {
        if (typeof filePathOrStore === 'string' || !filePathOrStore) {
            this.store = new RequestLogFileStore(filePathOrStore);
            return;
        }
        this.store = filePathOrStore;
    }

    appendFromMusic(music: Music, url?: string): RequestLogEntry | null {
        if (!music.requesterHash || !isValidRequesterHash(music.requesterHash)) return null;

        const requestedAtMs = Date.parse(music.requestedAt ?? '');
        const entry = normalizeEntry({
            id: randomUUID(),
            musicId: music.id,
            requesterHash: music.requesterHash,
            requesterName: music.requesterName ?? 'guest',
            requestedAt: Number.isFinite(requestedAtMs)
                ? new Date(requestedAtMs).toISOString()
                : new Date().toISOString(),
            title: music.title,
            url: url ?? watchUrl(music.id),
        });
        if (!entry) return null;

        void Promise.resolve(this.store.append(entry)).catch(error => {
            logger.warn('RequestLogService: failed to append request log entry', { error });
        });
        return entry;
    }

    /**
     * The store owns filtering, ordering and the limit; what is left here is the persistence
     * boundary check — rows that no longer parse, or that outlived the retention window the
     * backend has not pruned yet, must never reach the admin UI.
     */
    async query(input?: RequestLogQuery): Promise<MaskedRequestLogEntry[]> {
        const nowMs = Date.now();
        const sourceRows = await this.store.query(input);

        const rows: RequestLogEntry[] = [];
        for (const row of sourceRows) {
            const entry = normalizeEntry(row);
            if (entry && isWithinRetention(entry, nowMs)) rows.push(entry);
        }
        if (rows.length < sourceRows.length) {
            logger.warn('RequestLogService: dropped unusable request log entries', {
                droppedCount: sourceRows.length - rows.length,
            });
        }

        return rows.slice(0, input?.limit ?? DEFAULT_LIMIT).map(maskEntry);
    }

    async flush(): Promise<void> {
        await this.store.pruneExpired(new Date());
        await this.store.flush();
    }

    closeSync(): void {
        void this.store.pruneExpired(new Date());
        this.store.closeSync();
    }
}

let requestLogServiceSingleton: RequestLogService | undefined;

export function setRequestLogService(service: RequestLogService): void {
    requestLogServiceSingleton = service;
}

export function getRequestLogService(): RequestLogService {
    if (!requestLogServiceSingleton) requestLogServiceSingleton = new RequestLogService();
    return requestLogServiceSingleton;
}

export function resetRequestLogService(): void {
    requestLogServiceSingleton = undefined;
}
