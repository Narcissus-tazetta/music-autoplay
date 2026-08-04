/**
 * Public surface of the error utilities. Everything re-exported here has at least one
 * caller outside this directory; helpers used only within `errors/` (getErrorLogger,
 * normalizeWrapOptions) are imported from their own module instead of being re-published
 * here. The type guards are likewise imported straight from `../typeGuards`.
 */

export type { ErrorInfo, HandlerError, NormalizedWrapOptions, WrapOptions } from './core';
export { extractErrorInfo, safeString, toHandlerError } from './core';

export type { Logger } from './wrappers';
export { withErrorHandler, wrapAsync } from './wrappers';

export type { Result } from './result-handlers';
export { err, isErr, isOk, ok, safeExecuteAsync } from './result-handlers';

export type { ReplyOptions } from './server';
export {
    createAdminHash,
    createAuthErrorReply,
    createRateLimitReply,
    createServerErrorReply,
    createValidationErrorReply,
} from './server';

export { extractErrorMessage } from './client';
