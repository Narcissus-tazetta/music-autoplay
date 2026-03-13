import { parseApiErrorForUI } from '@/shared/utils/apiUi';
import type { UiAction } from '@/shared/utils/apiUi';
import { extractErrorMessage } from '@/shared/utils/errors/client';

type UnknownRecord = Record<string, unknown>;

interface FormErrorResult {
    readonly formErrorsString: string | undefined;
    readonly parsedAction: UiAction | undefined;
}

const EMPTY_RESULT: FormErrorResult = {
    formErrorsString: undefined,
    parsedAction: undefined,
};

const isRecord = (value: unknown): value is UnknownRecord => {
    return value != undefined && typeof value === 'object';
};

const extractDeepestData = (data: unknown): unknown => {
    if (!isRecord(data)) return data;

    if ('result' in data && data.result) return extractDeepestData(data.result);

    return data;
};

const collectErrorStrings = (value: unknown): string[] => {
    if (typeof value === 'string') return [value];

    if (Array.isArray(value)) return value.flatMap(item => collectErrorStrings(item));

    if (isRecord(value)) return Object.values(value).flatMap(item => collectErrorStrings(item));

    return [];
};

const extractErrorString = (value: unknown): string | undefined => {
    const messages = collectErrorStrings(value).filter(Boolean);
    return messages.length > 0 ? messages.join(' ') : undefined;
};

const extractFormErrors = (data: UnknownRecord): FormErrorResult | null => {
    if ('submission' in data && isRecord(data.submission)) {
        const submission = data.submission;
        if ('error' in submission) {
            const errorString = extractErrorString(submission.error);
            if (errorString) return { formErrorsString: errorString, parsedAction: undefined };
        }

        if ('fieldErrors' in submission) {
            const errorString = extractErrorString(submission.fieldErrors);
            if (errorString) return { formErrorsString: errorString, parsedAction: undefined };
        }
    }

    if ('error' in data) {
        const errorString = extractErrorString(data.error);
        if (errorString) return { formErrorsString: errorString, parsedAction: undefined };
    }

    if ('formErrors' in data) {
        const errorString = extractErrorString(data.formErrors);
        if (errorString) return { formErrorsString: errorString, parsedAction: undefined };
    }

    if ('fieldErrors' in data) {
        const errorString = extractErrorString(data.fieldErrors);
        if (errorString) return { formErrorsString: errorString, parsedAction: undefined };
    }

    return null;
};

const extractApiError = (data: UnknownRecord): FormErrorResult | null => {
    if (data.success !== false || !isRecord(data.error)) return null;

    const errObj = data.error;
    const code = typeof errObj.code === 'string' ? errObj.code : undefined;
    const message = typeof errObj.message === 'string' ? errObj.message : 'エラー';

    const parsed = parseApiErrorForUI({ code, details: errObj.details, message });

    const formErrorsString = parsed.kind === 'validation' && 'fieldErrors' in parsed
        ? Object.values(parsed.fieldErrors as Record<string, string>).join(' ')
        : parsed.message;

    return {
        formErrorsString,
        parsedAction: parsed.action as UiAction | undefined,
    };
};

export const useFormErrors = (fetcherData: unknown): FormErrorResult => {
    const deepData = extractDeepestData(fetcherData);

    if (!isRecord(deepData)) return EMPTY_RESULT;

    const apiError = extractApiError(deepData);
    if (apiError) return apiError;

    const formErrors = extractFormErrors(deepData);
    if (formErrors) return formErrors;

    const fallbackError = extractErrorMessage(deepData, { joinWith: ' ' });
    return fallbackError
        ? { formErrorsString: fallbackError, parsedAction: undefined }
        : EMPTY_RESULT;
};

export default useFormErrors;
