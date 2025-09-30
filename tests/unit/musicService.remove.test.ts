/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SERVER_ENV } from "../../src/app/env.server";
import MusicService from "../../src/server/music/musicService";
import ServiceResolver from "../../src/server/utils/serviceResolver";

class RepoStub {
  private db = new Map<string, any>();
  constructor(initial?: Record<string, any>) {
    if (initial) {
      for (const [k, v] of Object.entries(initial)) this.db.set(k, v);
    }
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
  persistAdd(_m: any): Promise<void> {
    return Promise.resolve(undefined);
  }
  persistRemove(_id: string): void {
    return;
  }
}

describe("MusicService.removeMusic authorization", () => {
  let getInstanceSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    getInstanceSpy = undefined;
  });

  afterEach(() => {
    if (getInstanceSpy && typeof getInstanceSpy.mockRestore === "function")
      getInstanceSpy.mockRestore();
  });

  it("returns not found when id missing", () => {
    const repo = new RepoStub();
    const svc = new MusicService(repo as any, {} as any, (() => true) as any);
    const res = svc.removeMusic("https://youtu.be/nope", undefined);
    expect(res && (res as any).formErrors).toBeTruthy();
  });

  it("forbids when existing has no requesterHash and requester is not admin", () => {
    const repo = new RepoStub({
      id1: { id: "id1", title: "T", channelId: "c", channelName: "cn" },
    });
    const svc = new MusicService(repo as any, {} as any, (() => true) as any);
    const res = svc.removeMusic("https://youtu.be/id1", "not-admin");
    expect(res && (res as any).formErrors).toBeTruthy();
  });

  it("allows original requester to delete", () => {
    const repo = new RepoStub({
      id2: {
        id: "id2",
        title: "T2",
        channelId: "c",
        channelName: "cn",
        requesterHash: "me",
      },
    });
    const emitted: Array<{ ev: string; payload: unknown }> = [];
    const emitFn = (ev: string, payload: unknown) => {
      emitted.push({ ev, payload });
      return true;
    };
    const svc = new MusicService(repo as any, {} as any, emitFn as any);
    const res = svc.removeMusic("id2", "me");
    expect((res as any).formErrors).toBeUndefined();
    expect(emitted.some((e) => e.ev === "musicRemoved")).toBeTruthy();
  });

  it("allows admin deletion using ADMIN_SECRET digest", () => {
    // Mock ServiceResolver to provide configService with ADMIN_SECRET
    const mockConfigService = {
      getString: (key: string) => {
        if (key === "ADMIN_SECRET") return SERVER_ENV.ADMIN_SECRET;
        return "";
      },
    };

    const mockServiceResolver = {
      resolveDependencies: () => ({
        configService: mockConfigService,
      }),
    };

    // use vi.spyOn to avoid unbound-method lint warning and keep a reference to restore
    getInstanceSpy = vi
      .spyOn(ServiceResolver, "getInstance")
      .mockImplementation(() => mockServiceResolver as unknown as any);

    // Construct admin-like requesterHash matching SERVER_ENV.ADMIN_SECRET digest
    const hashHex = createHash("sha256")
      .update(SERVER_ENV.ADMIN_SECRET)
      .digest("hex");

    const repo = new RepoStub({
      id3: { id: "id3", title: "T3", channelId: "c", channelName: "cn" },
    });
    const emitted: Array<{ ev: string; payload: unknown }> = [];
    const emitFn = (ev: string, payload: unknown) => {
      emitted.push({ ev, payload });
      return true;
    };

    const svc = new MusicService(repo as any, {} as any, emitFn as any);
    const res = svc.removeMusic("id3", hashHex);
    expect((res as any).formErrors).toBeUndefined();
    expect(emitted.some((e) => e.ev === "musicRemoved")).toBeTruthy();
  });
});
