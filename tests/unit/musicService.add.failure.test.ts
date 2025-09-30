/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { describe, expect, it } from "vitest";
import MusicService from "../../src/server/music/musicService";

class RepoStub {
  private db = new Map<string, any>();
  fileStore: any;
  constructor(throwOnPersist = false) {
    this.fileStore = {
      // return a rejected promise to simulate async failure instead of throwing synchronously
      add: throwOnPersist
        ? () => Promise.reject(new Error("disk fail"))
        : () => Promise.resolve(undefined),
      remove: () => undefined,
    };
  }
  has(id: string) {
    return this.db.has(id);
  }
  get(id: string) {
    return this.db.get(id);
  }
  add(m: any) {
    this.db.set(m.id, m);
  }
  remove(id: string) {
    this.db.delete(id);
  }
  list() {
    return Array.from(this.db.values());
  }
  buildCompatList() {
    return this.list().map((m: any) => ({
      ...m,
      url: `https://youtu.be/${m.id}`,
    }));
  }
  async persistAdd(m: any): Promise<void> {
    try {
      return await Promise.resolve(this.fileStore.add(m));
    } catch (e) {
      // swallow to simulate repository's warn-and-ignore behavior
      void e;
      return;
    }
  }
  persistRemove(_id: string): void {
    return;
  }
}

describe("MusicService.addMusic persist failure handling", () => {
  it("still returns success and emits even if persistAdd throws", async () => {
    const repo = new RepoStub(true);
    const resolver = {
      resolve: (u: string) =>
        Promise.resolve({
          ok: true,
          value: {
            id: "vidF",
            title: "TF",
            channelTitle: "C",
            channelId: "chF",
          },
        }),
    };
    const emitted: Array<{ ev: string; payload: unknown }> = [];
    const emitFn = (ev: string, payload: unknown) => {
      emitted.push({ ev, payload });
      return true;
    };

    const svc = new MusicService(repo as any, resolver as any, emitFn as any);
    const res = await svc.addMusic("https://youtu.be/vidF", "reqh");
    // service should return success despite persistence failure
    expect(res).toEqual({});
    // repo should have the item
    expect(repo.has("vidF")).toBe(true);
    // emits should have occurred
    expect(emitted.some((e) => e.ev === "musicAdded")).toBeTruthy();
  });
});
