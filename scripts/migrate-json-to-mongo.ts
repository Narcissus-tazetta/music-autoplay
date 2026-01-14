import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { MongoStore } from '../src/server/persistence/mongo';
import type { PersistFile } from '../src/server/persistence/types';

function getArgValue(flag: string): string | undefined {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return undefined;
    const val = process.argv[idx + 1];
    if (!val || val.startsWith('--')) return undefined;
    return val;
}

function hasFlag(flag: string): boolean {
    return process.argv.includes(flag);
}

async function main() {
    const filePath = getArgValue('--file')
        ?? path.resolve(process.cwd(), 'data', 'musicRequests.json');

    const uri = getArgValue('--uri') ?? process.env.MONGODB_URI;
    const dbName = getArgValue('--db') ?? process.env.MONGODB_DB_NAME ?? 'musicReq';
    const collectionName = getArgValue('--collection')
        ?? process.env.MONGODB_COLLECTION
        ?? 'musicRequests';

    const dryRun = hasFlag('--dry-run');
    const backup = hasFlag('--backup');

    if (!uri) throw new Error('Missing MongoDB URI. Provide --uri or set MONGODB_URI.');

    if (!fs.existsSync(filePath)) throw new Error(`Input file not found: ${filePath}`);

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as PersistFile;
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    console.log('[migrate-json-to-mongo] input', {
        filePath,
        items: items.length,
        dbName,
        collectionName,
        dryRun,
        backup,
    });

    if (dryRun) {
        console.log('[migrate-json-to-mongo] dry-run: exiting without writes');
        return;
    }

    if (backup) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${filePath}.bak.${ts}`;
        fs.copyFileSync(filePath, backupPath);
        console.log('[migrate-json-to-mongo] backup created', { backupPath });
    }

    const store = new MongoStore({ uri, dbName, collectionName });
    await store.initialize();

    let ok = 0;
    let failed = 0;

    for (const m of items) {
        try {
            // Upsert by id; idempotent
            // eslint-disable-next-line no-await-in-loop
            await store.add(m);
            ok++;
        } catch (error) {
            failed++;
            console.warn('[migrate-json-to-mongo] failed to upsert', {
                id: (m as { id?: unknown })?.id,
                error,
            });
        }
    }

    await store.close();

    console.log('[migrate-json-to-mongo] done', { ok, failed });
    if (failed > 0) process.exitCode = 1;
}

void main().catch(err => {
    console.error('[migrate-json-to-mongo] fatal', err);
    process.exit(1);
});
