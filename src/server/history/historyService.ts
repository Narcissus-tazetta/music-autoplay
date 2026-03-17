import { HistoryFileStore } from '@/server/history/historyFileStore';
import type { HistoryStore } from '@/server/history/historyStore';
import type { Music } from '@/shared/stores/musicStore';
import type { HistoryItem, HistoryQuery, HistorySort } from '@/shared/types/history';
import logger from '../logger';

const HISTORY_RETENTION_YEARS = 3;
const HISTORY_RETENTION_MS = HISTORY_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const ISO_8601_DURATION_PATTERN = /^PT(?=\d)(\d+H)?(\d+M)?(\d+S)?$/;
const HH_MM_SS_DURATION_PATTERN = /^\d{2}:\d{2}:\d{2}$/;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBoundaryMs(value: string | undefined, isEnd: boolean): number {
    if (!value) return NaN;
    if (!DATE_ONLY_PATTERN.test(value)) return Date.parse(value);

    const start = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(start)) return NaN;
    if (!isEnd) return start;
    return start + (24 * 60 * 60 * 1000) - 1;
}

function isRecordableMusic(music: Music): boolean {
    if (!music) return false;

    const id = music.id.trim();
    if (!YOUTUBE_ID_PATTERN.test(id)) return false;

    if (music.title.trim().length === 0) return false;
    if (music.channelName.trim().length === 0) return false;

    const duration = music.duration.trim();
    if (!ISO_8601_DURATION_PATTERN.test(duration) && !HH_MM_SS_DURATION_PATTERN.test(duration)) return false;

    return true;
}

function normalizePlayedAtIso(input?: string): string {
    if (!input) return new Date().toISOString();
    const ms = Date.parse(input);
    if (!Number.isFinite(ms)) return new Date().toISOString();
    return new Date(ms).toISOString();
}

export class HistoryService {
    private readonly store: HistoryStore;
    private readonly itemsById = new Map<string, HistoryItem>();
    private loaded = false;

    constructor(filePathOrStore?: string | HistoryStore) {
        if (typeof filePathOrStore === 'string' || !filePathOrStore) {
            this.store = new HistoryFileStore(filePathOrStore);
            return;
        }

        this.store = filePathOrStore;
    }

    private ensureLoaded(): void {
        if (this.loaded) return;
        this.loaded = true;
        const persisted = this.store.load();
        for (const item of persisted.items) this.itemsById.set(item.id, item);
        this.pruneExpired(Date.now());
    }

    private pruneExpired(nowMs: number): void {
        const cutoff = nowMs - HISTORY_RETENTION_MS;
        const removedIds: string[] = [];
        for (const [id, item] of this.itemsById.entries()) {
            const ts = Date.parse(item.lastPlayedAt);
            if (!Number.isFinite(ts) || ts < cutoff) {
                this.itemsById.delete(id);
                removedIds.push(id);
            }
        }
        for (const id of removedIds) this.store.remove(id);
    }

    recordPlayed(music: Music, playedAtIso?: string): HistoryItem {
        if (!isRecordableMusic(music)) {
            logger.warn('historyService: skipped invalid music payload', {
                musicId: music?.id,
                title: music?.title,
                channelName: music?.channelName,
                duration: music?.duration,
            });
            throw new Error('historyService: invalid music payload');
        }

        this.ensureLoaded();
        const nowIso = normalizePlayedAtIso(playedAtIso);
        const normalizedMusic: Music = {
            ...music,
            id: music.id.trim(),
            title: music.title.trim(),
            channelName: music.channelName.trim(),
            duration: music.duration.trim(),
        };
        const existing = this.itemsById.get(normalizedMusic.id);

        if (existing) {
            const next: HistoryItem = {
                ...existing,
                channelId: normalizedMusic.channelId,
                channelName: normalizedMusic.channelName,
                duration: normalizedMusic.duration,
                lastPlayedAt: nowIso,
                playCount: existing.playCount + 1,
                title: normalizedMusic.title,
            };
            this.itemsById.set(normalizedMusic.id, next);
            this.pruneExpired(Date.now());
            this.store.upsert(next);
            return next;
        }

        const created: HistoryItem = {
            channelId: normalizedMusic.channelId,
            channelName: normalizedMusic.channelName,
            duration: normalizedMusic.duration,
            firstPlayedAt: nowIso,
            id: normalizedMusic.id,
            lastPlayedAt: nowIso,
            playCount: 1,
            title: normalizedMusic.title,
        };
        this.itemsById.set(normalizedMusic.id, created);
        this.pruneExpired(Date.now());
        this.store.upsert(created);
        return created;
    }

    query(input?: HistoryQuery): HistoryItem[] {
        this.ensureLoaded();
        this.pruneExpired(Date.now());

        const sort: HistorySort = input?.sort ?? 'newest';
        const q = (input?.query ?? '').trim().toLowerCase();
        const fromMs = parseBoundaryMs(input?.from, false);
        const toMs = parseBoundaryMs(input?.to, true);

        let rows = [...this.itemsById.values()];

        if (q.length > 0) {
            rows = rows.filter(item => {
                const target = `${item.title} ${item.channelName} ${item.id}`.toLowerCase();
                return target.includes(q);
            });
        }

        if (Number.isFinite(fromMs)) rows = rows.filter(item => Date.parse(item.lastPlayedAt) >= fromMs);
        if (Number.isFinite(toMs)) rows = rows.filter(item => Date.parse(item.lastPlayedAt) <= toMs);

        if (sort === 'oldest') {
            rows.sort((a, b) => Date.parse(a.lastPlayedAt) - Date.parse(b.lastPlayedAt));
            return rows;
        }

        if (sort === 'mostPlayed') {
            rows.sort((a, b) => {
                if (b.playCount !== a.playCount) return b.playCount - a.playCount;
                return Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt);
            });
            return rows;
        }

        rows.sort((a, b) => Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt));
        return rows;
    }

    async flush(): Promise<void> {
        if (typeof this.store.flush === 'function') await this.store.flush();
    }

    closeSync(): void {
        if (typeof this.store.closeSync === 'function') this.store.closeSync();
    }
}

let historyServiceSingleton: HistoryService | undefined;

export function setHistoryService(service: HistoryService): void {
    historyServiceSingleton = service;
}

export function getHistoryService(): HistoryService {
    if (!historyServiceSingleton) historyServiceSingleton = new HistoryService();
    return historyServiceSingleton;
}
