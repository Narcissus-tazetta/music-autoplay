import type { Server as IOServer, Socket } from "socket.io";
import logger from "../logger";
import type { EventMap, EventName } from "../types/socketEvents";

export interface EmitContext {
  operation?: string;
  identifiers?: Record<string, unknown>;
  source?: string;
}

export interface SafeEmitOptions {
  context?: EmitContext;
  errorPrefix?: string;
  logLevel?: "debug" | "info" | "warn" | "error";
  silent?: boolean;
}

export function safeEmit<K extends EventName>(
  emitter: IOServer | Socket,
  event: K,
  ...args: EventMap[K] extends readonly [infer P, ...infer Rest]
    ? Rest extends readonly []
      ? [payload: P, options?: SafeEmitOptions]
      : [payload: P, ...rest: Rest, options?: SafeEmitOptions]
    : [options?: SafeEmitOptions]
): boolean {
  const lastArg = args[args.length - 1];
  const isOptions =
    lastArg &&
    typeof lastArg === "object" &&
    ("context" in lastArg ||
      "errorPrefix" in lastArg ||
      "logLevel" in lastArg ||
      "silent" in lastArg);

  const options: SafeEmitOptions = isOptions
    ? (lastArg as SafeEmitOptions)
    : {};
  const emitArgs = isOptions ? args.slice(0, -1) : args;

  const {
    context = {},
    errorPrefix = "failed to emit",
    logLevel = "warn",
    silent = false,
  } = options;

  try {
    if ("emit" in emitter && typeof emitter.emit === "function") {
      emitter.emit(event, ...emitArgs);
      return true;
    } else {
      if (!silent) {
        logger[logLevel](`${errorPrefix}: invalid emitter`, {
          event,
          context,
          emitterType: typeof emitter,
        });
      }
      return false;
    }
  } catch (error: unknown) {
    if (!silent) {
      logger[logLevel](`${errorPrefix} ${event}`, {
        error,
        event,
        context,
        payload: emitArgs.length > 0 ? emitArgs[0] : undefined,
        ...context.identifiers,
      });
    }
    return false;
  }
}

export function safeEmitSync<K extends EventName>(
  emitter: IOServer | Socket,
  event: K,
  ...args: EventMap[K] extends readonly [infer P, ...infer Rest]
    ? Rest extends readonly []
      ? [payload: P, options?: SafeEmitOptions]
      : [payload: P, ...rest: Rest, options?: SafeEmitOptions]
    : [options?: SafeEmitOptions]
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  return safeEmit(emitter, event, ...(args as unknown as any));
}

export function createSafeEmitter(
  emitter: IOServer | Socket,
  defaultContext: EmitContext,
) {
  return function <K extends EventName>(
    event: K,
    ...args: EventMap[K] extends readonly [infer P, ...infer Rest]
      ? Rest extends readonly []
        ? [payload: P, options?: SafeEmitOptions]
        : [payload: P, ...rest: Rest, options?: SafeEmitOptions]
      : [options?: SafeEmitOptions]
  ): boolean {
    const lastArg = args[args.length - 1];
    const isOptions =
      lastArg &&
      typeof lastArg === "object" &&
      ("context" in lastArg ||
        "errorPrefix" in lastArg ||
        "logLevel" in lastArg ||
        "silent" in lastArg);

    const userOptions: SafeEmitOptions = isOptions
      ? (lastArg as SafeEmitOptions)
      : {};
    const emitArgs = isOptions ? args.slice(0, -1) : args;

    const mergedOptions: SafeEmitOptions = {
      ...userOptions,
      context: {
        ...defaultContext,
        ...userOptions.context,
        identifiers: {
          ...defaultContext.identifiers,
          ...userOptions.context?.identifiers,
        },
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return safeEmit(
      emitter,
      event,
      ...([...emitArgs, mergedOptions] as unknown as any),
    );
  };
}

export function createSafeEmitterSync(
  emitter: IOServer | Socket,
  defaultContext: EmitContext,
) {
  return function <K extends EventName>(
    event: K,
    ...args: EventMap[K] extends readonly [infer P, ...infer Rest]
      ? Rest extends readonly []
        ? [payload: P, options?: SafeEmitOptions]
        : [payload: P, ...rest: Rest, options?: SafeEmitOptions]
      : [options?: SafeEmitOptions]
  ): boolean {
    const lastArg = args[args.length - 1];
    const isOptions =
      lastArg &&
      typeof lastArg === "object" &&
      ("context" in lastArg ||
        "errorPrefix" in lastArg ||
        "logLevel" in lastArg ||
        "silent" in lastArg);

    const userOptions: SafeEmitOptions = isOptions
      ? (lastArg as SafeEmitOptions)
      : {};
    const emitArgs = isOptions ? args.slice(0, -1) : args;

    const mergedOptions: SafeEmitOptions = {
      ...userOptions,
      context: {
        ...defaultContext,
        ...userOptions.context,
        identifiers: {
          ...defaultContext.identifiers,
          ...userOptions.context?.identifiers,
        },
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return safeEmitSync(
      emitter,
      event,
      ...([...emitArgs, mergedOptions] as unknown as any),
    );
  };
}

export function wrapEmitWithSafety(
  emitFn: (event: string, payload: unknown) => void,
  defaultOptions: SafeEmitOptions = {},
): (event: string, payload: unknown, options?: SafeEmitOptions) => boolean {
  return (
    event: string,
    payload: unknown,
    options: SafeEmitOptions = {},
  ): boolean => {
    const mergedOptions: SafeEmitOptions = {
      ...defaultOptions,
      ...options,
      context: {
        ...defaultOptions.context,
        ...options.context,
        identifiers: {
          ...defaultOptions.context?.identifiers,
          ...options.context?.identifiers,
        },
      },
    };

    const {
      context = {},
      errorPrefix = "failed to emit",
      logLevel = "warn",
      silent = false,
    } = mergedOptions;

    try {
      emitFn(event, payload);
      return true;
    } catch (error: unknown) {
      if (!silent) {
        logger[logLevel](`${errorPrefix} ${event}`, {
          error,
          event,
          payload,
          context,
          ...context.identifiers,
        });
      }
      return false;
    }
  };
}
