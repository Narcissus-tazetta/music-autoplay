/**
 * Legacy errorUtils.ts - Re-export from unified error system
 *
 * This file maintains backward compatibility by re-exporting from
 * the new unified error handling system in ./errors/
 *
 * @deprecated Import from '@/shared/utils/errors' instead
 */
export type {
  ErrorInfo,
  HandlerError,
  ReplyOptions,
  WrapOptions,
} from "./errors";

export {
  createAdminHash,
  createErrorReply,
  createServerErrorReply,
  createValidationErrorReply,
  errorUtils,
  extractErrorInfo,
  handleAsyncError,
  isAuthorizationError,
  resultToThrow,
  safeExecute,
  safeExecuteAsync,
  safeString,
  toHandlerError,
  withAsyncErrorHandler,
  withErrorHandler,
  wrap,
  wrapAsync,
} from "./errors";
export { default } from "./errors";
