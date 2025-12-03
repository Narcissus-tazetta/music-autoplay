import { SERVER_ENV } from '@/app/env.server';
import logger from '@/server/logger';
import type { Music } from '@/shared/stores/musicStore';
import { Pool } from 'pg';
import { container } from '../di/container';

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
        const cfg = container.getOptional('configService') as
            | { getString?(key: string): string }
            | undefined;
        const cfgVal = cfg?.getString?.('DATABASE_URL');
        const envVal = typeof SERVER_ENV.DATABASE_URL === 'string'
                && SERVER_ENV.DATABASE_URL.length > 0
            ? SERVER_ENV.DATABASE_URL
            : undefined;

        const conn: string | undefined = connectionString
            ?? (typeof cfgVal === 'string' && cfgVal.length > 0 ? cfgVal : envVal);

        if (!conn) {
            logger.warn(
                'PgStore: no DATABASE_URL provided via args or ConfigService; falling back to SERVER_ENV or Pool defaults',
            );
        }

        this.pool = new Pool({
            connectionString: conn,
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
        const res = await this.pool.query<DbMusicRow>(
            `SELECT * FROM musics ORDER BY created_at ASC`,
        );
        return res.rows.map(r => ({
            id: r.id,
            title: r.title,
            channelName: r.channel_name ?? '',
            channelId: r.channel_id ?? '',
            duration: r.duration != null ? `${r.duration}` : '',
            requesterHash: r.requester_hash ?? undefined,
        }));
    }

    async add(m: Music) {
        const durationNumber = m.duration ? Number(m.duration) : null;
        await this.pool.query(
            `INSERT INTO musics (id, title, channel_name, channel_id, duration, requester_hash, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,now())
             ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, channel_name = EXCLUDED.channel_name, channel_id = EXCLUDED.channel_id, duration = EXCLUDED.duration, requester_hash = EXCLUDED.requester_hash`,
            [
                m.id,
                m.title,
                m.channelName,
                m.channelId,
                durationNumber,
                m.requesterHash ?? null,
            ],
        );
    }

    async remove(id: string) {
        await this.pool.query(`DELETE FROM musics WHERE id = $1`, [id]);
    }

    async clear() {
        await this.pool.query(`DELETE FROM musics`);
    }

    async close() {
        await this.pool.end();
        logger.debug('PgStore: pool closed');
    }
    // FileStore インターフェースとの互換性のための意図的な no-op の flush です。
    // 一部の実装ではバックグラウンド書き込みを行っていますが、PgStore は即時に永続化します。
    async flush(): Promise<void> {
        await Promise.resolve();
        return;
    }
}

export default PgStore;
