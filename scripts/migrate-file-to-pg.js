#!/usr/bin/env node
/*
Simple migration script: reads data/musicRequests.json and inserts into Postgres.
Usage: DATABASE_URL=postgres://... node scripts/migrate-file-to-pg.js
*/
import fs from "fs";
import path from "path";
import { Pool } from "pg";

const FILE = path.resolve(process.cwd(), "data", "musicRequests.json");
const DATABASE_URL = process.env.DATABASE_URL;

function usageAndExit(code = 1) {
  console.error(
    "Usage: DATABASE_URL=postgres://user:pw@host:port/db node scripts/migrate-file-to-pg.js",
  );
  process.exit(code);
}

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  usageAndExit(1);
}

if (!fs.existsSync(FILE)) {
  console.error(`No file to migrate at: ${FILE}`);
  usageAndExit(2);
}

let raw;
try {
  raw = fs.readFileSync(FILE, "utf8");
} catch (e) {
  console.error("Failed to read file", e);
  usageAndExit(3);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error("Failed to parse JSON file", e);
  usageAndExit(4);
}

const items = Array.isArray(parsed.items) ? parsed.items : [];

const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  let inserted = 0;
  let failed = 0;
  try {
    await pool.query(`
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

    // Batch insert with transaction and retry/backoff
    const BATCH_SIZE = Number(process.env.MIGRATE_BATCH_SIZE || 500);
    const RETRY_ATTEMPTS = 3;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
      const batch = items.slice(offset, offset + BATCH_SIZE);
      let attempt = 0;
      while (attempt < RETRY_ATTEMPTS) {
        attempt++;
        try {
          // build multi-row insert values
          const params = [];
          const valuePlaceholders = batch
            .map((it, idx) => {
              const base = idx * 6;
              params.push(
                it.id,
                it.title,
                it.channelName ?? null,
                it.channelId ?? null,
                it.duration ?? null,
                it.requesterHash ?? null,
              );
              return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},now())`;
            })
            .join(",");

          const query = `INSERT INTO musics (id, title, channel_name, channel_id, duration, requester_hash, created_at) VALUES ${valuePlaceholders} ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, channel_name = EXCLUDED.channel_name, channel_id = EXCLUDED.channel_id, duration = EXCLUDED.duration, requester_hash = EXCLUDED.requester_hash`;

          await pool.query("BEGIN");
          const res = await pool.query(query, params);
          await pool.query("COMMIT");

          inserted += res.rowCount || batch.length;
          console.log(
            `Batch ${Math.floor(offset / BATCH_SIZE) + 1}: processed ${batch.length} rows (offset=${offset})`,
          );
          break; // success -> exit retry ループ
        } catch (batchErr) {
          try {
            await pool.query("ROLLBACK");
          } catch (rbErr) {
            console.warn("Rollback failed", rbErr);
          }
          const backoff = 200 * Math.pow(2, attempt - 1);
          console.warn(
            `Batch failed attempt ${attempt}/${RETRY_ATTEMPTS}, retrying in ${backoff}ms`,
            batchErr,
          );
          if (attempt >= RETRY_ATTEMPTS) {
            failed += batch.length;
            console.error(
              `Batch permanently failed after ${RETRY_ATTEMPTS} attempts, offset=${offset}`,
            );
          } else {
            await sleep(backoff);
          }
        }
      }
    }

    console.log(
      `Migration complete. processed=${items.length} inserted~=${inserted} failed=${failed}`,
    );
    if (failed > 0) process.exit(5);
    process.exit(0);
  } catch (e) {
    console.error("Migration failed", e);
    process.exit(6);
  } finally {
    await pool.end();
  }
})();
