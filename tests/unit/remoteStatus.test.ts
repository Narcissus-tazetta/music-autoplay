import { describe, expect, it } from "vitest";
import type { RemoteStatus } from "../../src/app/stores/musicStore";
import {
  isRemoteStatusEqual,
  shouldDebounce,
} from "../../src/server/socket/remoteStatus";

describe("remoteStatus helpers", () => {
  it("isRemoteStatusEqual returns true for same closed types", () => {
    const a: RemoteStatus = { type: "closed" };
    const b: RemoteStatus = { type: "closed" };
    expect(isRemoteStatusEqual(a, b)).toBe(true);
  });

  it("isRemoteStatusEqual compares playing titles", () => {
    const a: RemoteStatus = { type: "playing", musicTitle: "x" };
    const b: RemoteStatus = { type: "playing", musicTitle: "x" };
    const c: RemoteStatus = { type: "playing", musicTitle: "y" };
    expect(isRemoteStatusEqual(a, b)).toBe(true);
    expect(isRemoteStatusEqual(a, c)).toBe(false);
  });

  it("shouldDebounce works with time differences", () => {
    const prev = Date.now() - 100;
    expect(shouldDebounce(prev, Date.now(), 250)).toBe(true);
    expect(shouldDebounce(prev, Date.now() + 1000, 250)).toBe(false);
  });
});
