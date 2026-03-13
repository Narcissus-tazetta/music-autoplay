import type { Music } from '@/shared/stores/musicStore';
import type { HistoryItem, HistoryQuery, HistorySort } from '@/shared/types/history';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../logger';

type HistoryPersistFile = {
    items: HistoryItem[];
    lastUpdated?: string;
};

const DEFAULT_HISTORY_PATH = path.resolve(process.cwd(), 'data', 'history.json');
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const FLUSH_DELAY_MS = 400;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBoundaryMs(value: string | undefined, isEnd: boolean): number {
    if (!value) return NaN;
    if (!DATE_ONLY_PATTERN.test(value)) return Date.parse(value);

    const start = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(start)) return NaN;
    if (!isEnd) return start;
    return start + (24 * 60 * 60 * 1000) - 1;
}

export class HistoryService {
    private readonly filePath: string;
    private readonly itemsById = new Map<string, HistoryItem>();
    private loaded = false;
    private flushTimer: NodeJS.Timeout | null = null;

    constructor(filePath?: string) {
        this.filePath = filePath ?? DEFAULT_HISTORY_PATH;
    }

    private ensureLoaded(): void {
        if (this.loaded) return;
        this.loaded = true;
        this.ensureDataDir();
        const persisted = this.readFileSafe();
        for (const item of persisted.items) this.itemsById.set(item.id, item);
        this.pruneExpired(Date.now());
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
            logger.warn('historyService read failed', { error });
            return { items: [] };
        }
    }

    private scheduleFlush(): void {
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flush();
        }, FLUSH_DELAY_MS);
    }

    private async flush(): Promise<void> {
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
            logger.warn('historyService flush failed', { error });
        }
    }

    private pruneExpired(nowMs: number): void {
        const cutoff = nowMs - ONE_YEAR_MS;
        let removed = 0;
        for (const [id, item] of this.itemsById.entries()) {
            const ts = Date.parse(item.lastPlayedAt);
            if (!Number.isFinite(ts) || ts < cutoff) {
                this.itemsById.delete(id);
                removed++;
            }
        }
        if (removed > 0) this.scheduleFlush();
    }

    recordPlayed(music: Music, playedAtIso?: string): HistoryItem {
        this.ensureLoaded();
        const nowIso = playedAtIso ?? new Date().toISOString();
        const existing = this.itemsById.get(music.id);

        if (existing) {
            const next: HistoryItem = {
                ...existing,
                channelId: music.channelId,
                channelName: music.channelName,
                duration: music.duration,
                lastPlayedAt: nowIso,
                playCount: existing.playCount + 1,
                title: music.title,
            };
            this.itemsById.set(music.id, next);
            this.pruneExpired(Date.now());
            this.scheduleFlush();
            return next;
        }

        const created: HistoryItem = {
            channelId: music.channelId,
            channelName: music.channelName,
            duration: music.duration,
            firstPlayedAt: nowIso,
            id: music.id,
            lastPlayedAt: nowIso,
            playCount: 1,
            title: music.title,
        };
        this.itemsById.set(music.id, created);
        this.pruneExpired(Date.now());
        this.scheduleFlush();
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
}

let historyServiceSingleton: HistoryService | undefined;

export function getHistoryService(): HistoryService {
    if (!historyServiceSingleton) historyServiceSingleton = new HistoryService();
    return historyServiceSingleton;
}
