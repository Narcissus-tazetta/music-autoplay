/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SERVER_ENV } from "../../src/app/env.server";
import { container } from "../../src/server/di/container";
import MusicRepository from "../../src/server/music/musicRepository";
import MusicService, { type EmitFn } from "../../src/server/music/musicService";
import type YouTubeResolver from "../../src/server/music/youtubeResolver";
import type { VideoMetaResult } from "../../src/server/music/youtubeResolver";
import type { Store } from "../../src/server/persistence/types";
import ConfigService from "../../src/server/services/configService";

type Music = {
  id: string;
  title?: string;
  channelId?: string;
  channelName?: string;
  duration?: string;
  requesterHash?: string;
};

describe("新しいマネージャー統合テスト", () => {
  beforeEach(() => {
    // ensure container cleared between tests
    const inst = (container as unknown as Record<string, unknown>)[
      "instances"
    ] as { clear?: () => void } | undefined;
    if (inst && typeof inst.clear === "function") inst.clear();
    const facts = (container as unknown as Record<string, unknown>)[
      "factories"
    ] as { clear?: () => void } | undefined;
    if (facts && typeof facts.clear === "function") facts.clear();
  });

  afterEach(() => {
    // same cleanup
    const inst = (container as unknown as Record<string, unknown>)[
      "instances"
    ] as { clear?: () => void } | undefined;
    if (inst && typeof inst.clear === "function") inst.clear();
    const facts = (container as unknown as Record<string, unknown>)[
      "factories"
    ] as { clear?: () => void } | undefined;
    if (facts && typeof facts.clear === "function") facts.clear();
  });

  it("ConfigService の基本取得", () => {
    const cfg = new ConfigService();
    const maybe = cfg.getString("NODE_ENV" as keyof typeof SERVER_ENV, "dev");
    expect(typeof maybe === "string").toBe(true);
  });

  it("MusicRepository と MusicService の基本連携", async () => {
    const musicDB = new Map<string, Music>();
    const fileStore: Store = {
      load() {
        return [];
      },
      add(_m: Music) {
        return;
      },
      remove(_id: string) {
        return;
      },
      clear() {
        return;
      },
    } as unknown as Store;

    // MusicRepository expects the Music type from app stores; cast at callsite to avoid strict coupling in tests
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const repo = new MusicRepository(
      musicDB as unknown as Map<string, any>,
      fileStore,
    );
    const emitted: Array<{ ev: string; payload: unknown }> = [];

    // typed resolver stub matching minimal shape
    const resolverStub: Pick<YouTubeResolver, "resolve"> = {
      resolve(u: string): Promise<VideoMetaResult> {
        return Promise.resolve({
          ok: true,
          value: { id: u },
        } as unknown as VideoMetaResult);
      },
    };

    const typedEmit: EmitFn = (ev: string, payload: unknown) => {
      emitted.push({ ev, payload });
      return true;
    };

    const svc = new MusicService(
      repo,
      resolverStub as unknown as YouTubeResolver,
      typedEmit,
    );
    // add music via service
    const res = (await svc.addMusic("video123")) as { formErrors?: string[] };
    expect(res.formErrors).toBeUndefined();

    // remove music (simulate requester hash absent -> forbidden)
    const rem = svc.removeMusic("video123") as { formErrors?: string[] };
    expect(rem.formErrors).toBeDefined();
  });
});
