/**
 * Public surface of the error utilities. Everything re-exported here has at least one
 * caller outside this directory; helpers used only within `errors/` (getErrorLogger,
 * normalizeWrapOptions) are imported from their own module instead of being re-published
 * here. The type guards are likewise imported straight from `../typeGuards`.
 */

export type { HandlerError } from './core';
export { extractErrorInfo, safeString, toHandlerError } from './core';

export { withErrorHandler, wrapAsync } from './wrappers';

export { safeExecuteAsync } from './result-handlers';

export type { ReplyOptions } from './server';
export {
    createAdminHash,
    createAuthErrorReply,
    createRateLimitReply,
    createServerErrorReply,
    createValidationErrorReply,
} from './server';
