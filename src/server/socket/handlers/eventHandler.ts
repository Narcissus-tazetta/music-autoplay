import {
  createAuthErrorReply,
  createRateLimitReply,
  createServerErrorReply,
  createValidationErrorReply,
  type ReplyOptions,
} from "@/shared/utils/errors";
import { wrapAsync } from "@/shared/utils/errors";
import type { Socket } from "socket.io";
import type { ZodError, ZodSchema } from "zod";
import logger, { withContext } from "../../logger";
import { RateLimiter } from "../../services/rateLimiter";

export interface AuthContext {
  socketId: string;
  requesterHash?: string;
}

export interface EventContext extends Record<string, unknown> {
  socketId: string;
  requestId?: string;
  connectionId?: string;
}

export type AuthChecker = (context: AuthContext) => boolean | Promise<boolean>;

export interface RateLimiterConfig {
  maxAttempts: number;
  windowMs: number;
  keyGenerator?: (socket: Socket) => string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface EventHandlerConfig<TPayload, TResponse> {
  event: string;
  validator?: ZodSchema<TPayload>;
  handler: (
    payload: TPayload,
    context: EventContext,
  ) => Promise<TResponse> | TResponse;
  rateLimiter?: RateLimiterConfig;
  auth?: AuthChecker;
  logPayload?: boolean;
  logResponse?: boolean;
}

interface CallbackFunction {
  (response: ReplyOptions | unknown): void;
}

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.errors) {
    const path = issue.path.join(".");
    const field = path || "root";

    if (!fieldErrors[field]) fieldErrors[field] = [];

    fieldErrors[field].push(issue.message);
  }

  return fieldErrors;
}

function extractPayloadFromArgs(args: unknown[]): unknown {
  if (args.length === 0) return undefined;
  if (args.length === 1) return args[0];

  const lastArg = args[args.length - 1];
  if (typeof lastArg === "function")
    return args.length === 2 ? args[0] : args.slice(0, -1);

  return args;
}

function extractCallbackFromArgs(
  args: unknown[],
): CallbackFunction | undefined {
  if (args.length === 0) return undefined;

  const lastArg = args[args.length - 1];
  if (typeof lastArg === "function") return lastArg as CallbackFunction;

  return undefined;
}

export function createSocketEventHandler<TPayload, TResponse>(
  config: EventHandlerConfig<TPayload, TResponse>,
) {
  const rateLimiter = config.rateLimiter
    ? new RateLimiter(
        config.rateLimiter.maxAttempts,
        config.rateLimiter.windowMs,
      )
    : undefined;

  return (socket: Socket, context?: EventContext) => {
    const ctx: EventContext = context ?? {
      socketId: socket.id,
    };

    const log = context
      ? withContext(context as Record<string, unknown>)
      : logger;

    const wrappedHandler = wrapAsync(async (...args: unknown[]) => {
      const payload = extractPayloadFromArgs(args);
      const callback = extractCallbackFromArgs(args);

      if (config.logPayload) {
        log.debug(`socket event received: ${config.event}`, {
          socketId: ctx.socketId,
          payload,
        });
      }

      if (rateLimiter) {
        const rateLimitKey = config.rateLimiter?.keyGenerator
          ? config.rateLimiter.keyGenerator(socket)
          : socket.id;

        if (!rateLimiter.tryConsume(rateLimitKey)) {
          const reply = createRateLimitReply();
          if (callback) callback(reply);

          log.warn(`rate limit exceeded: ${config.event}`, {
            socketId: ctx.socketId,
            key: rateLimitKey,
          });

          return;
        }
      }

      if (config.auth) {
        const authContext: AuthContext = {
          socketId: socket.id,
          requesterHash:
            typeof payload === "object" &&
            payload !== null &&
            "requesterHash" in payload
              ? String((payload as { requesterHash?: unknown }).requesterHash)
              : undefined,
        };

        const isAuthorized = await config.auth(authContext);

        if (!isAuthorized) {
          const reply = createAuthErrorReply();
          if (callback) callback(reply);

          log.warn(`auth failed: ${config.event}`, {
            socketId: ctx.socketId,
          });

          return;
        }
      }

      if (config.validator) {
        const validation = config.validator.safeParse(payload);

        if (!validation.success) {
          const fieldErrors = formatZodErrors(validation.error);
          const reply = createValidationErrorReply(fieldErrors);

          if (callback) callback(reply);

          log.debug(`validation failed: ${config.event}`, {
            socketId: ctx.socketId,
            errors: fieldErrors,
          });

          return;
        }

        try {
          const result = await config.handler(validation.data, ctx);

          if (config.logResponse) {
            log.debug(`socket event response: ${config.event}`, {
              socketId: ctx.socketId,
              result,
            });
          }

          if (callback) callback(result as ReplyOptions);
        } catch (error: unknown) {
          log.error(`handler error: ${config.event}`, {
            socketId: ctx.socketId,
            error,
          });

          const reply = createServerErrorReply(error);
          if (callback) callback(reply);
        }
      } else {
        try {
          const result = await config.handler(payload as TPayload, ctx);

          if (config.logResponse) {
            log.debug(`socket event response: ${config.event}`, {
              socketId: ctx.socketId,
              result,
            });
          }

          if (callback) callback(result as ReplyOptions);
        } catch (error: unknown) {
          log.error(`handler error: ${config.event}`, {
            socketId: ctx.socketId,
            error,
          });

          const reply = createServerErrorReply(error);
          if (callback) callback(reply);
        }
      }
    }, `socket:${config.event}`);

    socket.on(config.event, wrappedHandler);
  };
}

export function createTypedSocketEventHandler<
  TPayload extends Record<string, unknown>,
  TResponse,
>(config: EventHandlerConfig<TPayload, TResponse>) {
  return createSocketEventHandler(config);
}

export interface BatchEventHandlerConfig {
  handlers: Array<{
    event: string;
    handler: (socket: Socket, context?: EventContext) => void;
  }>;
}

export function registerBatchHandlers(
  socket: Socket,
  config: BatchEventHandlerConfig,
  context?: EventContext,
) {
  for (const { event, handler } of config.handlers) {
    try {
      handler(socket, context);
    } catch (error: unknown) {
      const log = context
        ? withContext(context as Record<string, unknown>)
        : logger;
      log.error(`failed to register handler: ${event}`, {
        socketId: socket.id,
        error,
      });
    }
  }
}
