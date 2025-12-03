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
    createAdminHash: serverUtils.createAdminHash,
    createAuthErrorReply: serverUtils.createAuthErrorReply,
    createDuplicateReply: serverUtils.createDuplicateReply,
    createErrorReply: serverUtils.createErrorReply,
    createNotFoundReply: serverUtils.createNotFoundReply,
    createServerErrorReply: serverUtils.createServerErrorReply,
    createSuccessReply: serverUtils.createSuccessReply,
    createValidationErrorReply: serverUtils.createValidationErrorReply,
    errorToString: coreUtils.errorToString,
    extractApiError: clientUtils.extractApiError,
    extractErrorInfo: coreUtils.extractErrorInfo,
    extractErrorMessage: clientUtils.extractErrorMessage,
    formatErrorForDisplay: clientUtils.formatErrorForDisplay,
    handleAsyncError: wrapperUtils.handleAsyncError,
    isApiErrorResponse: clientUtils.isApiErrorResponse,
    isAuthorizationError: coreUtils.isAuthorizationError,
    isError: coreUtils.isError,
    isNetworkError: coreUtils.isNetworkError,
    isNotFoundError: coreUtils.isNotFoundError,
    isValidationError: coreUtils.isValidationError,
    resultOr: resultUtils.resultOr,
    resultOrUndefined: resultUtils.resultOrUndefined,
    resultToThrow: resultUtils.resultToThrow,
    safeExecute: resultUtils.safeExecute,
    safeExecuteAsync: resultUtils.safeExecuteAsync,
    safeString: coreUtils.safeString,
    toHandlerError: coreUtils.toHandlerError,
    tryAsync: wrapperUtils.tryAsync,
    trySync: wrapperUtils.trySync,
    withAsyncErrorHandler: wrapperUtils.wrapAsync,
    withErrorHandler: wrapperUtils.wrap,
    wrap: wrapperUtils.wrap,
    wrapAsync: wrapperUtils.wrapAsync,
} as const;

export default errorUtils;
