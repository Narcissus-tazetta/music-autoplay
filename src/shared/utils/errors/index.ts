/**
 * Public surface of the error utilities. Everything re-exported here has at least one
 * caller; the previous barrel also carried `errorUtils` (a namespace object duplicating
 * the same functions) and `withErrorHandler2` / `withAsyncErrorHandler2` / `safeExecuteSync`
 * aliases, none of which were ever imported.
 */
export { isRecord, isThenable } from '../typeGuards';

export type { ErrorInfo, HandlerError, NormalizedWrapOptions, WrapOptions } from './core';
export { extractErrorInfo, normalizeWrapOptions, safeString, toHandlerError } from './core';

export type { Logger } from './wrappers';
export { getErrorLogger, withAsyncErrorHandler, withErrorHandler, wrap, wrapAsync } from './wrappers';

export type { Result } from './result-handlers';
export {
    chainResult,
    combineResults,
    err,
    isErr,
    isOk,
    mapResult,
    ok,
    safeExecute,
    safeExecuteAsync,
} from './result-handlers';

export type { ReplyOptions } from './server';
export {
    createAdminHash,
    createAuthErrorReply,
    createRateLimitReply,
    createServerErrorReply,
    createValidationErrorReply,
    isSuccessReply,
} from './server';

export { extractApiError, extractErrorMessage } from './client';
