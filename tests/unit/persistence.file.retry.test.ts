import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileStore } from "../../src/server/musicPersistence";
import fs from "fs";

describe("FileStore retry/backoff", () => {
    const tmpPath = "/tmp/music-test-retry.json";

    beforeEach(() => {
        vi.restoreAllMocks();
        try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (err) {
            // best-effort cleanup in test environment; ignore errors
            void err;
        }
    });

    it("retries on write failures and eventually succeeds", async () => {
        const store = new FileStore(tmpPath);

        // fail first two writeFile attempts, then succeed
        let call = 0;
        const writeMock = vi.spyOn(fs.promises, "writeFile").mockImplementation((): Promise<void> => {
            call += 1;
            if (call <= 2) return Promise.reject(new Error("EIO"));
            return Promise.resolve();
        });

        const renameMock = vi.spyOn(fs.promises, "rename").mockResolvedValue(undefined);

        store.add({
            id: "retry",
            title: "R",
            channelName: "C",
            channelId: "cid",
            duration: "PT1M",
        });

        // flush should internally retry and eventually resolve
        await store.flush();

        // ensure we attempted writes multiple times (at least 3: 2 failures + 1 success)
        // vitest spy objects expose .mock property; assert via provided API
        expect((writeMock as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(renameMock).toHaveBeenCalled();
    });
});
