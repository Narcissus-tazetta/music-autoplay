// emit は任意のペイロード/コンテキストを受け入れるため、実行時の防御的ガードが意図的に使っています。
import type { Server as IOServer } from "socket.io";
import logger from "../logger";
import { safeString } from "./errorHandling";

export type EmitOptions = {
  context?: {
    source?: string;
    operation?: string;
    identifiers?: Record<string, unknown>;
  };
  errorPrefix?: string;
  logLevel?: "debug" | "info" | "warn" | "error";
  silent?: boolean;
};

export type LegacyEmitFn = ((
  ev: string,
  payload: unknown,
) => boolean | undefined) & { __isSocketEmitter?: true };

export class SocketEmitter {
  private ioGetter: () => IOServer;
  private defaultContext: EmitOptions["context"] | undefined;

  constructor(
    ioGetter: () => IOServer,
    defaultContext?: EmitOptions["context"],
  ) {
    this.ioGetter = ioGetter;
    this.defaultContext = defaultContext;
  }

  emit(event: string, payload: unknown, opts: EmitOptions = {}): boolean {
    const {
      context = {},
      errorPrefix = "failed to emit",
      logLevel = "warn",
      silent = false,
    } = opts;
    const mergedContext = { ...(this.defaultContext || {}), ...context };

    try {
      const io = this.ioGetter();
      if (typeof io.emit !== "function") {
        if (!silent)
          logger[logLevel](`${errorPrefix}: invalid emitter`, {
            event,
            context: mergedContext,
          });
        return false;
      }
      io.emit(event, payload);
      return true;
    } catch (err: unknown) {
      if (!silent) {
        logger[logLevel](`${errorPrefix} ${event}`, {
          error: err,
          event,
          payload: safeString(payload),
          context: mergedContext,
          ...(mergedContext.identifiers || {}),
        });
      }
      return false;
    }
  }

  asFn(): LegacyEmitFn {
    const fn = ((ev: string, payload: unknown) => {
      this.emit(ev, payload);
      return undefined;
    }) as LegacyEmitFn;
    fn.__isSocketEmitter = true;
    return fn;
  }
}

export function createSocketEmitter(
  ioGetter: () => IOServer,
  defaultContext?: EmitOptions["context"],
) {
  return new SocketEmitter(ioGetter, defaultContext);
}
