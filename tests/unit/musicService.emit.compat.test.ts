/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it, vi } from "vitest";
import MusicService from "../../src/server/music/musicService";
import type { EmitFn } from "../../src/server/music/musicService";

// Minimal in-memory repo implementing the subset of MusicRepository API used by MusicService
class RepoStub {
  private db: Map<string, unknown>;
  constructor() {
    this.db = new Map();
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
    return Array.from(this.db.values()) as any[];
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

describe("MusicService emit compatibility", () => {
  it("calls emitFn for musicAdded/addMusic/url_list with correct payloads using plain EmitFn", async () => {
    const repo = new RepoStub();
    const resolver = {
      resolve: (_u: string) =>
        Promise.resolve({
          ok: true,
          value: {
            id: "vid1",
            title: "T",
            channelTitle: "C",
            channelId: "ch",
            duration: "PT0S",
          },
        }),
    };
    const emitSpy = vi.fn((_ev: string, _payload: unknown) => true) as EmitFn;

    const svc = new MusicService(repo as any, resolver as any, emitSpy);

    const res = await svc.addMusic("https://youtu.be/vid1", "reqh");
    expect(res).toEqual({});
    // musicAdded emitted with Music shape
    expect(emitSpy).toHaveBeenCalledWith(
      "musicAdded",
      expect.objectContaining({ id: "vid1", title: "T" }),
      expect.anything(),
    );
    // legacy addMusic emitted with url
    expect(emitSpy).toHaveBeenCalledWith(
      "addMusic",
      expect.objectContaining({ url: expect.any(String) }),
      expect.anything(),
    );
    // url_list emitted
    expect(emitSpy).toHaveBeenCalledWith(
      "url_list",
      expect.any(Array),
      expect.anything(),
    );
  });

  it("works with SocketEmitter.asFn() legacy adapter (returns boolean and swallows errors)", async () => {
    // create a fake socket-like emitter where emit throws once
    const socket = {
      emit: vi.fn(() => {
        return false;
      }),
    } as any;
    // build an asFn-like wrapper mimicking SocketEmitter.asFn()
    const asFn = ((ev: string, payload: unknown) => {
      try {
        // intentionally call socket.emit which returns false
        void socket.emit(ev, payload);
      } catch {
        // swallow
      }
      return false;
    }) as EmitFn & { __isSocketEmitter?: true };
    asFn.__isSocketEmitter = true;

    const repo = new RepoStub();
    const resolver = {
      resolve: (_u: string) =>
        Promise.resolve({
          ok: true,
          value: {
            id: "vid2",
            title: "T2",
            channelTitle: "C2",
            channelId: "ch2",
          },
        }),
    };

    const svc = new MusicService(repo as any, resolver as any, asFn as EmitFn);
    const res = await svc.addMusic("https://youtu.be/vid2", undefined);
    expect(res).toEqual({});
    // ensure underlying socket.emit was invoked for one of the legacy events
    expect(socket.emit).toHaveBeenCalled();
  });
});
