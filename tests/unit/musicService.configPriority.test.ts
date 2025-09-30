import { createHash } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { container } from "../../src/server/di/container";
import type MusicRepository from "../../src/server/music/musicRepository";
import MusicService, { type EmitFn } from "../../src/server/music/musicService";
import type YouTubeResolver from "../../src/server/music/youtubeResolver";

type Music = {
  id: string;
  title: string;
  channelId: string;
  channelName: string;
  duration?: string;
  requesterHash?: string;
};

class RepoStub {
  private db = new Map<string, Music>();
  has(id: string) {
    return this.db.has(id);
  }
  get(id: string) {
    return this.db.get(id);
  }
  add(m: Music) {
    this.db.set(m.id, m);
  }
  remove(id: string) {
    this.db.delete(id);
  }
  list(): Music[] {
    return Array.from(this.db.values());
  }
  buildCompatList() {
    return this.list().map((m) => ({ ...m, url: `https://youtu.be/${m.id}` }));
  }
  persistAdd(_m: Music): Promise<void> {
    return Promise.resolve();
  }
  persistRemove(_id: string): void {
    return;
  }
}

afterEach(() => {
  // clean any container registrations to avoid leaking between tests
  // access container internals for cleanup in test context
  const inst = (container as unknown as Record<string, unknown>)[
    "instances"
  ] as { clear?: () => void } | undefined;
  if (inst && typeof inst.clear === "function") inst.clear();
  const facts = (container as unknown as Record<string, unknown>)[
    "factories"
  ] as { clear?: () => void } | undefined;
  if (facts && typeof facts.clear === "function") facts.clear();
});

describe("MusicService config priority", () => {
  it("prefers ConfigService ADMIN_SECRET over SERVER_ENV and container adminHash", () => {
    // register a configService that returns a custom ADMIN_SECRET
    const cfg = {
      getString: (k: string) =>
        k === "ADMIN_SECRET" ? "cfg-secret" : undefined,
      getNumber: (_: string) => undefined,
    } as {
      getString: (k: string) => string | undefined;
      getNumber: (k: string) => number | undefined;
    };
    container.register("configService", () => cfg);

    // create repo and add an item without requesterHash
    const repo = new RepoStub();
    repo.add({ id: "x", title: "T", channelId: "c", channelName: "cn" });

    // compute digest of cfg-secret (frontend uses hex digest)
    const digest = createHash("sha256").update("cfg-secret").digest("hex");

    const emitted: Array<{ ev: string; payload: unknown }> = [];
    const emitFn = (ev: string, payload: unknown): boolean => {
      emitted.push({ ev, payload });
      return true;
    };

    // Minimal typed stubs for dependencies: repo, youtubeResolver, emit function
    const resolverStub: YouTubeResolver = {
      resolve: (_u: string) => ({ ok: true, value: { id: "x" } as unknown }),
    } as unknown as YouTubeResolver;

    const svc = new MusicService(
      repo as unknown as MusicRepository,
      resolverStub,
      emitFn as EmitFn,
    );
    const res = svc.removeMusic("x", digest) as { formErrors?: string[] };
    expect(res.formErrors).toBeUndefined();
    expect(emitted.some((e) => e.ev === "musicRemoved")).toBeTruthy();
  });
});
