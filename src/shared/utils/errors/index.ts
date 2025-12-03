export { isRecord, isThenable } from '../typeGuards';
export type { ErrorInfo, HandlerError, NormalizedWrapOptions, WrapOptions } from './core';

export {
    errorToString,
    extractErrorInfo,
    isAuthorizationError,
    isError,
    isNetworkError,
    isNotFoundError,
    isStackTrace,
    isValidationError,
    normalizeWrapOptions,
    safeString,
    toHandlerError,
} from './core';

import * as clientUtils from './client';
import * as coreUtils from './core';
import * as resultUtils from './result-handlers';
import * as serverUtils from './server';
import * as wrapperUtils from './wrappers';

export type { Logger } from './wrappers';

export {
    defaultLogger,
    getErrorLogger,
    handleAsyncError,
    setErrorLogger,
    tryAsync,
    trySync,
    withAsyncErrorHandler,
    withErrorHandler,
    wrap,
    wrapAsync,
} from './wrappers';

export {
    chainResult,
    collectErrors,
    collectOks,
    combineResults,
    isErr,
    isOk,
    mapError,
    mapResult,
    resultOr,
    resultOrUndefined,
    resultToThrow,
    safeExecute,
    safeExecuteAsync,
} from './result-handlers';

export type { ReplyOptions, SuccessReply } from './server';

export {
    createAdminHash,
    createAuthErrorReply,
    createDuplicateReply,
    createErrorReply,
    createNotFoundReply,
    createRateLimitReply,
    createServerErrorReply,
    createSuccessReply,
    createValidationErrorReply,
    extractReplyErrors,
    isErrorReply,
    isSuccessReply,
    mapErrorToCode,
} from './server';

export type { FormatOptions } from './client';

export {
    extractApiError,
    extractErrorMessage,
    formatErrorForDisplay,
    formatMultipleErrors,
    getDetailedErrorInfo,
    isApiErrorResponse,
    logErrorForDev,
} from './client';

export { safeExecute as safeExecuteSync } from './result-handlers';
export { wrap as withErrorHandler2 } from './wrappers';
export { wrapAsync as withAsyncErrorHandler2 } from './wrappers';
export const errorUtils = {
    isError: coreUtils.isError,
    extractErrorInfo: coreUtils.extractErrorInfo,
    toHandlerError: coreUtils.toHandlerError,
    safeString: coreUtils.safeString,
    errorToString: coreUtils.errorToString,
    wrap: wrapperUtils.wrap,
    wrapAsync: wrapperUtils.wrapAsync,
    withErrorHandler: wrapperUtils.wrap,
    withAsyncErrorHandler: wrapperUtils.wrapAsync,
    handleAsyncError: wrapperUtils.handleAsyncError,
    trySync: wrapperUtils.trySync,
    tryAsync: wrapperUtils.tryAsync,
    safeExecute: resultUtils.safeExecute,
    safeExecuteAsync: resultUtils.safeExecuteAsync,
    resultToThrow: resultUtils.resultToThrow,
    resultOr: resultUtils.resultOr,
    resultOrUndefined: resultUtils.resultOrUndefined,
    createErrorReply: serverUtils.createErrorReply,
    createValidationErrorReply: serverUtils.createValidationErrorReply,
    createServerErrorReply: serverUtils.createServerErrorReply,
    createSuccessReply: serverUtils.createSuccessReply,
    createAuthErrorReply: serverUtils.createAuthErrorReply,
    createNotFoundReply: serverUtils.createNotFoundReply,
    createDuplicateReply: serverUtils.createDuplicateReply,
    createAdminHash: serverUtils.createAdminHash,
    extractErrorMessage: clientUtils.extractErrorMessage,
    formatErrorForDisplay: clientUtils.formatErrorForDisplay,
    extractApiError: clientUtils.extractApiError,
    isApiErrorResponse: clientUtils.isApiErrorResponse,
    isAuthorizationError: coreUtils.isAuthorizationError,
    isValidationError: coreUtils.isValidationError,
    isNotFoundError: coreUtils.isNotFoundError,
    isNetworkError: coreUtils.isNetworkError,
} as const;

export default errorUtils;
