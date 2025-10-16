import { createGetAllMusicsHandler } from "../../src/server/socket/handlers/standardHandlers";
import { describe, expect, it } from "../bunTestCompat";

describe("getAllMusics", () => {
  it("returns all musics from musicDB via callback", async () => {
    const musicDB = new Map<string, any>();
    musicDB.set("a1", { id: "a1", title: "One" });
    musicDB.set("b2", { id: "b2", title: "Two" });

    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const socketStub = {
      id: "stub-socket",
      on: (ev: string, cb: (...args: unknown[]) => void) => {
        handlers[ev] = cb;
        return socketStub;
      },
    } as any;

    const registerHandler = createGetAllMusicsHandler(musicDB);
    registerHandler(socketStub, {
      socketId: "stub-socket",
      connectionId: "test-conn",
    });

    const resultPromise = new Promise<unknown>((resolve) => {
      const callback = (response: unknown) => {
        resolve(response);
      };

      handlers["getAllMusics"]?.({}, callback);
    });

    const result = await resultPromise;

    expect(Array.isArray(result)).toBe(true);
    const ids = (result as any[]).map((m: any) => m.id).sort();
    expect(ids).toEqual(["a1", "b2"]);
  });
});
