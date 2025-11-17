import logger from "@/server/logger";
import type { Music } from "@/shared/stores/musicStore";
import type { PgStore } from "./pg";
import type { PersistFile, Store } from "./types";

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

  addSync(m: Music) {
    this.current.items = this.current.items || [];
    const idx = this.current.items.findIndex((x) => x.id === m.id);
    if (idx >= 0) this.current.items[idx] = m;
    else this.current.items.push(m);
    this.current.lastUpdated = new Date().toISOString();
    const p = this.pg.add(m).catch((e: unknown) =>
      logger.warn("PgHybridStore: failed to add", {
        error: e,
      }),
    );
    this.pendingWrites.push(p);
    void p.finally(() => {
      this.pendingWrites = this.pendingWrites.filter((x) => x !== p);
    });
  }

  add(m: Music): void | Promise<void> {
    this.addSync(m);
  }

  removeSync(id: string) {
    this.current.items = (this.current.items || []).filter((x) => x.id !== id);
    this.current.lastUpdated = new Date().toISOString();
    const p = this.pg.remove(id).catch((e: unknown) =>
      logger.warn("PgHybridStore: failed to remove", {
        error: e,
      }),
    );
    this.pendingWrites.push(p);
    void p.finally(() => {
      this.pendingWrites = this.pendingWrites.filter((x) => x !== p);
    });
  }

  remove(id: string): void | Promise<void> {
    this.removeSync(id);
  }

  clearSync() {
    this.current = { items: [], lastUpdated: new Date().toISOString() };
    const p = this.pg.clear().catch((e: unknown) =>
      logger.warn("PgHybridStore: failed to clear", {
        error: e,
      }),
    );
    this.pendingWrites.push(p);
    void p.finally(() => {
      this.pendingWrites = this.pendingWrites.filter((x) => x !== p);
    });
  }

  clear(): void {
    this.clearSync();
  }

  async flush() {
    try {
      await Promise.all(this.pendingWrites);
    } catch (e: unknown) {
      logger.warn("PgHybridStore: flush encountered errors", {
        error: e,
      });
    }
  }

  closeSync() {
    void this.flush();
  }
}

export default PgHybridStore;
