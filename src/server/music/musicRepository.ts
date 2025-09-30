import { watchUrl } from "@/shared/libs/youtube";
import type { Music } from "~/stores/musicStore";
import logger from "../logger";
import type { Store } from "../persistence";
import { persistAdd, persistRemove } from "../persistence/storeHelpers";

export default class MusicRepository {
  constructor(
    private musicDB: Map<string, Music>,
    private fileStore: Store,
  ) {}

  has(id: string) {
    return this.musicDB.has(id);
  }

  get(id: string) {
    return this.musicDB.get(id);
  }

  add(m: Music) {
    this.musicDB.set(m.id, m);
  }

  remove(id: string) {
    this.musicDB.delete(id);
  }

  list(): Music[] {
    return Array.from(this.musicDB.values());
  }

  buildCompatList(): (Music & { url: string })[] {
    try {
      return this.list().map((m) => ({ ...m, url: watchUrl(m.id) }));
    } catch (err: unknown) {
      logger.debug("MusicRepository.buildCompatList failed", { error: err });
      return [];
    }
  }

  async persistAdd(m: Music): Promise<void> {
    await persistAdd(this.fileStore, m);
  }

  persistRemove(id: string): void {
    void persistRemove(this.fileStore, id);
  }
}
