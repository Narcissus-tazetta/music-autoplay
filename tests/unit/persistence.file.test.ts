import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileStore } from "../../src/server/persistence";

describe("FileStore", () => {
  const tmpPath = "/tmp/music-test.json";

  beforeEach(() => {
    vi.restoreAllMocks();
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (err) {
      void err;
    }
  });

  it("loads and flushes without error", async () => {
    const store = new FileStore(tmpPath);
    expect(store.load()).toEqual([]);
    void store.add({
      id: "x",
      title: "T",
      channelName: "C",
      channelId: "cid",
      duration: "PT1M",
    });
    // mock write
    const writeSpy = vi
      .spyOn(fs.promises, "writeFile")
      .mockResolvedValue(undefined);
    const renameSpy = vi
      .spyOn(fs.promises, "rename")
      .mockResolvedValue(undefined);
    await store.flush();
    expect(writeSpy).toHaveBeenCalled();
    expect(renameSpy).toHaveBeenCalled();
  });
});
