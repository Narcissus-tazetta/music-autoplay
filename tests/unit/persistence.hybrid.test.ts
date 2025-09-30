import { describe, expect, it, vi } from "vitest";
import { PgHybridStore } from "../../src/server/persistence/hybrid";
import type { PgStore } from "../../src/server/persistence/pg";

describe("PgHybridStore", () => {
  it("queues pending writes and flush resolves", async () => {
    const addMock = vi.fn().mockResolvedValue(undefined);
    const removeMock = vi.fn().mockResolvedValue(undefined);
    const clearMock = vi.fn().mockResolvedValue(undefined);

    const pgMock: PgStore = {
      add: addMock as unknown as PgStore["add"],
      remove: removeMock as unknown as PgStore["remove"],
      clear: clearMock as unknown as PgStore["clear"],
      initialize: async () => {
        /* noop */
      },
      loadAll: () => [],
      close: async () => {
        /* noop */
      },
      // flush exists on PgStore but is optional for this test
      flush: async () => {
        await Promise.resolve();
      },
    } as unknown as PgStore;

    const store = new PgHybridStore(pgMock, []);
    void store.add({
      id: "a",
      title: "A",
      channelName: "C",
      channelId: "cid",
      duration: "PT1M",
    });
    void store.remove("a");
    await store.flush();
    expect(addMock).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalled();
  });
});
