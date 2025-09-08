import fs from "fs";
import path from "path";

import type { Music } from "~/stores/musicStore";

const DEFAULT_FILE_PATH = path.resolve(
  process.cwd(),
  "data",
  "musicRequests.json",
);

type PersistFile = { items: Music[]; lastUpdated?: string };

const MAX_WRITE_RETRIES = 5;
const WRITE_BACKOFF_BASE_MS = 200;
const FLUSH_DELAY_MS = 500;

export class FileStore {
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
        if (
          Number.isFinite(last) &&
          Date.now() - last > 7 * 24 * 60 * 60 * 1000
        ) {
          return { items: [], lastUpdated: parsed.lastUpdated };
        }
      }

      return parsed;
    } catch (e) {
      console.warn("musicPersistence: failed to read file", e);
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
      } catch (e) {
        try {
          if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        } catch {}
        const backoff = WRITE_BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(
          `musicPersistence: write attempt ${attempt + 1} failed, retrying in ${backoff}ms`,
          e,
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw new Error("musicPersistence: failed to write file after retries");
  }

  private async flushToDisk() {
    if (!this.current) return;
    try {
      await this.writeFileAtomicAsync(this.current);
    } catch (e) {
      console.warn("musicPersistence: failed to flush to disk", e);
      setTimeout(() => {
        void this.flushToDisk();
      }, WRITE_BACKOFF_BASE_MS);
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer as any);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushToDisk();
    }, FLUSH_DELAY_MS);
  }

  load(): Music[] {
    if (this.current) return this.current.items;
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
      clearTimeout(this.flushTimer as any);
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
    } catch (e) {
      console.warn("musicPersistence: failed to flush sync on exit", e);
    }
  }
}
export const defaultFileStore = new FileStore();

export default FileStore;
