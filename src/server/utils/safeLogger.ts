export function safeLog(level: "warn" | "debug", msg: string, meta?: unknown) {
  void import("../logger")
    .then((m) => {
      try {
        const maybe = (m.default as unknown as Record<string, unknown>)[level];
        if (typeof maybe === "function") {
          const fn = maybe as (...args: unknown[]) => unknown;
          try {
            fn(msg, meta);
            return;
          } catch (_e: unknown) {
            void _e;
          }
        }
        console.debug(msg, meta);
      } catch (_e: unknown) {
        console.debug(msg, meta, { err: _e });
      }
    })
    .catch((e: unknown) => {
      try {
        console.debug(msg, meta, { err: e });
      } catch (_e: unknown) {
        void _e;
      }
    });
}

export default { safeLog };
