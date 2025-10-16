import { importLogger } from "@/shared/schemas/logger";

export function safeLog(
  level: "warn" | "debug",
  msg: string,
  meta?: unknown,
): void {
  void importLogger()
    .then((logger) => {
      if (!logger) {
        console.debug(msg, meta);
        return;
      }

      try {
        const logFn = logger[level];
        if (typeof logFn === "function") logFn(msg, meta);
        else console.debug(msg, meta);
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
