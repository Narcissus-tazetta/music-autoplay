import { Pool } from "pg";
import fs from "fs";
import path from "path";
import logger from "@/server/logger";

import type { Music } from "~/stores/musicStore";

const DEFAULT_FILE_PATH = path.resolve(process.cwd(), "data", "musicRequests.json");

type PersistFile = { items?: Music[]; lastUpdated?: string };

const MAX_WRITE_RETRIES = 5;
const WRITE_BACKOFF_BASE_MS = 200;
const FLUSH_DELAY_MS = 500;

export interface Store {
    load(): Music[];
    add(m: Music): void;
    remove(id: string): void;
    clear(): void;
    flush?(): Promise<void>;
    closeSync?(): void;
}

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
            const raw = fs.readFileSync(this.filePath, "utf8");
            const parsed = JSON.parse(raw) as PersistFile;
            if (parsed.lastUpdated) {
                const last = new Date(parsed.lastUpdated).getTime();
                if (Number.isFinite(last) && Date.now() - last > 7 * 24 * 60 * 60 * 1000) {
                    return { items: [], lastUpdated: parsed.lastUpdated };
                }
            }

            return parsed;
        } catch (e: unknown) {
            logger.warn("musicPersistence: failed to read file", {
                error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
            });
            return { items: [] };
        }
    }

    private async writeFileAtomicAsync(obj: unknown) {
        const payload = JSON.stringify(obj, null, 2);
        const tmpBase = `${this.filePath}.${process.pid}`;

        for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt++) {
            const tmp = `${tmpBase}.${Date.now()}.tmp`;
            try {
                await fs.promises.writeFile(tmp, payload, "utf8");
                await fs.promises.rename(tmp, this.filePath);
                return;
            } catch (e: unknown) {
                try {
                    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
                } catch (e2: unknown) {
                    logger.warn("musicPersistence: failed to remove tmp file", {
                        error: e2 instanceof Error ? { message: e2.message, stack: e2.stack } : String(e2),
                    });
                }
                const backoff = WRITE_BACKOFF_BASE_MS * Math.pow(2, attempt);
                logger.warn(`musicPersistence: write attempt ${attempt + 1} failed, retrying in ${backoff}ms`, {
                    error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
                });
                await new Promise((r) => setTimeout(r, backoff));
            }
        }
        throw new Error("musicPersistence: failed to write file after retries");
    }

    private async flushToDisk() {
        if (!this.current) return;
        try {
            await this.writeFileAtomicAsync(this.current);
        } catch (e: unknown) {
            logger.warn("musicPersistence: failed to flush to disk", {
                error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
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

    add(m: Music) {
        if (!this.current) this.current = this.readFileSafeSync();
        this.current.items = this.current.items || [];
        const idx = this.current.items.findIndex((x) => x.id === m.id);
        if (idx >= 0) this.current.items[idx] = m;
        else this.current.items.push(m);
        this.current.lastUpdated = new Date().toISOString();
        this.scheduleFlush();
    }

    remove(id: string) {
        if (!this.current) this.current = this.readFileSafeSync();
        this.current.items = (this.current.items || []).filter((x) => x.id !== id);
        this.current.lastUpdated = new Date().toISOString();
        this.scheduleFlush();
    }

    clear() {
        this.current = { items: [], lastUpdated: new Date().toISOString() };
        this.scheduleFlush();
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
            fs.writeFileSync(tmp, JSON.stringify(this.current, null, 2), "utf8");
            fs.renameSync(tmp, this.filePath);
        } catch (e: unknown) {
            logger.warn("musicPersistence: failed to flush sync on exit", {
                error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
            });
        }
    }
}
export const defaultFileStore = new FileStore();

export default FileStore;

type DbMusicRow = {
    id: string;
    title: string;
    channel_name: string | null;
    channel_id: string | null;
    duration: number | null;
    requester_hash: string | null;
    created_at: string;
};

export class PgStore {
    private pool: Pool;
    constructor(connectionString?: string) {
        this.pool = new Pool({
            connectionString: connectionString ?? process.env.DATABASE_URL,
        });
    }

    async initialize() {
        await this.pool.query(`
      CREATE TABLE IF NOT EXISTS musics (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        channel_name TEXT,
        channel_id TEXT,
        duration INTEGER,
        requester_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    }

    async loadAll(): Promise<Music[]> {
        const res = await this.pool.query<DbMusicRow>(`SELECT * FROM musics ORDER BY created_at ASC`);
        return res.rows.map((r) => ({
            id: r.id,
            title: r.title,
            channelName: r.channel_name ?? "",
            channelId: r.channel_id ?? "",
            duration: r.duration != null ? String(r.duration) : "",
            requesterHash: r.requester_hash ?? undefined,
        }));
    }

    async add(m: Music) {
        const durationNumber = m.duration ? Number(m.duration) : null;
        await this.pool.query(
            `INSERT INTO musics (id, title, channel_name, channel_id, duration, requester_hash, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,now())
             ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, channel_name = EXCLUDED.channel_name, channel_id = EXCLUDED.channel_id, duration = EXCLUDED.duration, requester_hash = EXCLUDED.requester_hash`,
            [m.id, m.title, m.channelName, m.channelId, durationNumber, m.requesterHash ?? null]
        );
    }

    async remove(id: string) {
        await this.pool.query(`DELETE FROM musics WHERE id = $1`, [id]);
    }

    async clear() {
        await this.pool.query(`DELETE FROM musics`);
    }

    async flush() {}

    async close() {
        await this.pool.end();
    }
}
export class PgHybridStore implements Store {
    private current: PersistFile = {
        items: [],
        lastUpdated: new Date().toISOString(),
    };
    private pg: PgStore;
    private pendingWrites: Promise<unknown>[] = [];

    constructor(pg: PgStore, initial: Music[] = []) {
        this.pg = pg;
        this.current.items = initial;
    }

    load(): Music[] {
        this.current.items = this.current.items || [];
        return this.current.items;
    }

    add(m: Music) {
        this.current.items = this.current.items || [];
        const idx = this.current.items.findIndex((x) => x.id === m.id);
        if (idx >= 0) this.current.items[idx] = m;
        else this.current.items.push(m);
        this.current.lastUpdated = new Date().toISOString();
        const p = this.pg.add(m).catch((e: unknown) =>
            logger.warn("PgHybridStore: failed to add", {
                error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
            })
        );
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter((x) => x !== p);
        });
    }

    remove(id: string) {
        this.current.items = (this.current.items || []).filter((x) => x.id !== id);
        this.current.lastUpdated = new Date().toISOString();
        const p = this.pg.remove(id).catch((e: unknown) =>
            logger.warn("PgHybridStore: failed to remove", {
                error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
            })
        );
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter((x) => x !== p);
        });
    }

    clear() {
        this.current = { items: [], lastUpdated: new Date().toISOString() };
        const p = this.pg.clear().catch((e: unknown) =>
            logger.warn("PgHybridStore: failed to clear", {
                error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
            })
        );
        this.pendingWrites.push(p);
        void p.finally(() => {
            this.pendingWrites = this.pendingWrites.filter((x) => x !== p);
        });
    }

    async flush() {
        try {
            await Promise.all(this.pendingWrites);
        } catch (e: unknown) {
            logger.warn("PgHybridStore: flush encountered errors", {
                error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
            });
        }
    }

    closeSync() {
        void this.flush();
    }
}

/**
 * 永続ストアを作成します。DATABASE_URL が設定されていれば PgHybridStore（非同期初期化）を返し、
 * そうでなければファイルベースのストアを返します。
 */
export async function createPersistentStore(): Promise<{
    store: Store;
    isPg: boolean;
    pg?: PgStore;
}> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
        const pg = new PgStore(dbUrl);
        try {
            await pg.initialize();
        } catch (e) {
            logger.warn("PgStore: failed to initialize", { error: e });
            return { store: defaultFileStore, isPg: false };
        }
        let initial: Music[] = [];
        try {
            initial = await pg.loadAll();
        } catch (e) {
            logger.warn("PgStore: failed to load initial rows", { error: e });
        }
        const hybrid = new PgHybridStore(pg, initial);
        return { store: hybrid, isPg: true, pg };
    }
    return { store: defaultFileStore, isPg: false };
}
