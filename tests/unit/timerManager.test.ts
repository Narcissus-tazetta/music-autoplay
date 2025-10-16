import { TimerManager } from "../../src/server/utils/timerManager";
import { describe, expect, it } from "../bunTestCompat";

describe("TimerManager", () => {
  it("calls callback after timeout", async () => {
    const tm = new TimerManager();
    let called = false;
    tm.start("k1", 20, () => {
      called = true;
    });
    // wait up to 200ms for callback
    await new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (called) {
          clearInterval(check);
          resolve(true);
        }
      }, 5);
      setTimeout(() => {
        clearInterval(check);
        reject(new Error("callback not called"));
      }, 200);
    });
    expect(called).toBe(true);
  });

  it("clear prevents callback", async () => {
    const tm = new TimerManager();
    let called = false;
    tm.start("k2", 50, () => {
      called = true;
    });
    tm.clear("k2");
    await new Promise((r) => setTimeout(r, 120));
    expect(called).toBe(false);
  });

  it("clearAll prevents all callbacks", async () => {
    const tm = new TimerManager();
    let c1 = false;
    let c2 = false;
    tm.start("a", 40, () => (c1 = true));
    tm.start("b", 60, () => (c2 = true));
    tm.clearAll();
    await new Promise((r) => setTimeout(r, 150));
    expect(c1).toBe(false);
    expect(c2).toBe(false);
  });
});
