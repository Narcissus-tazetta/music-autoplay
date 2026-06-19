import { maskRequesterHash } from '@/app/requesterIdentity.server';
import type { Music } from '@/shared/stores/musicStore';
import type {
    MaskedRequestLogEntry,
    RequestLogEntry,
    RequestLogQuery,
    RequestLogStore,
} from '@/shared/types/requestLog';
import { watchUrl } from '@/shared/utils/youtube';
import { randomUUID } from 'node:crypto';
import logger from '../logger';
import { RequestLogFileStore } from './requestLogFileStore';

const REQUEST_LOG_RETENTION_DAYS = 30;
const REQUEST_LOG_RETENTION_MS = REQUEST_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const HASH_PREFIX_PATTERN = /^[a-f0-9]{4,64}$/i;
const MUSIC_ID_PATTERN = /^[A-Za-z0-9_-]{11,20}$/;
const MAX_LIMIT = 500;

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

function normalizeLimit(limit: unknown): number {
    return Math.min(Math.max(typeof limit === 'number' && Number.isFinite(limit) ? limit : 50, 1), MAX_LIMIT);
}

function maskEntry(entry: RequestLogEntry): MaskedRequestLogEntry {
    return {
        ...entry,
        requesterHash: maskRequesterHash(entry.requesterHash),
    };
}

export class RequestLogService {
    private readonly store: RequestLogStore;
    private loaded = false;

    constructor(filePathOrStore?: string | RequestLogStore) {
        if (typeof filePathOrStore === 'string' || !filePathOrStore) {
            this.store = new RequestLogFileStore(filePathOrStore);
            return;
        }
        this.store = filePathOrStore;
    }

    private ensureLoaded(): void {
        if (this.loaded) return;
        this.loaded = true;
    }

    private loadValidEntries(): RequestLogEntry[] {
        const persisted = this.store.load();
        const rawEntries = Array.isArray(persisted.entries)
            ? persisted.entries.map(normalizeEntry).filter((entry): entry is RequestLogEntry => entry !== null)
            : [];
        const invalidCount = Array.isArray(persisted.entries) ? persisted.entries.length - rawEntries.length : 0;
        if (invalidCount > 0) logger.warn('RequestLogService: ignored invalid request log entries', { invalidCount });
        return rawEntries;
    }

    private async pruneExpired(): Promise<void> {
        const now = new Date();
        if (typeof this.store.pruneExpired === 'function') {
            await this.store.pruneExpired(now);
            return;
        }

        if (typeof this.store.replace !== 'function') return;

        const nowMs = now.getTime();
        const entries = this.loadValidEntries().filter(entry => isWithinRetention(entry, nowMs));
        await this.store.replace(entries);
    }

    appendFromMusic(music: Music, url?: string): RequestLogEntry | null {
        if (!music.requesterHash || !isValidRequesterHash(music.requesterHash)) return null;

        this.ensureLoaded();
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

    async query(input?: RequestLogQuery): Promise<MaskedRequestLogEntry[]> {
        this.ensureLoaded();
        const limit = normalizeLimit(input?.limit);
        const rawRequesterHash = input?.requesterHash?.trim().toLowerCase();
        const requesterHash = rawRequesterHash && isValidRequesterHash(rawRequesterHash) ? rawRequesterHash : undefined;
        const rawHashPrefix = input?.hashPrefix?.trim().toLowerCase();
        const hashPrefix = rawHashPrefix && HASH_PREFIX_PATTERN.test(rawHashPrefix) ? rawHashPrefix : undefined;
        const nowMs = Date.now();

        const queryInput = {
            hashPrefix,
            limit,
            requesterHash,
        };

        const sourceRows = typeof this.store.query === 'function'
            ? await this.store.query(queryInput)
            : this.loadValidEntries();

        let rows = sourceRows
            .map(normalizeEntry)
            .filter((entry): entry is RequestLogEntry => entry !== null)
            .filter(entry => isWithinRetention(entry, nowMs));

        if (requesterHash) rows = rows.filter(entry => entry.requesterHash.toLowerCase() === requesterHash);
        else if (hashPrefix) rows = rows.filter(entry => entry.requesterHash.toLowerCase().startsWith(hashPrefix));

        rows.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
        return rows.slice(0, limit).map(maskEntry);
    }

    async flush(): Promise<void> {
        await this.pruneExpired();
        if (typeof this.store.flush === 'function') await this.store.flush();
    }

    closeSync(): void {
        void this.pruneExpired();
        if (typeof this.store.closeSync === 'function') this.store.closeSync();
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
