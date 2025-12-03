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

function isRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object';
}

function extractDeepestData(data: unknown): unknown {
    if (!isRecord(data)) return data;

    if ('result' in data && data.result) return extractDeepestData(data.result);

    return data;
}

function joinErrorArray(errors: unknown): string | undefined {
    if (!Array.isArray(errors)) return undefined;
    const stringErrors = errors.filter((e): e is string => typeof e === 'string');
    return stringErrors.length > 0 ? stringErrors.join(' ') : undefined;
}

function extractFormErrors(data: UnknownRecord): FormErrorResult | null {
    if ('submission' in data && isRecord(data.submission)) {
        const submission = data.submission;
        if ('error' in submission) {
            const errorString = joinErrorArray(submission.error);
            if (errorString) return { formErrorsString: errorString, parsedAction: undefined };
        }
    }

    if ('error' in data) {
        const errorString = joinErrorArray(data.error);
        if (errorString) return { formErrorsString: errorString, parsedAction: undefined };
    }

    if ('formErrors' in data) {
        const errorString = joinErrorArray(data.formErrors);
        if (errorString) return { formErrorsString: errorString, parsedAction: undefined };
    }

    return null;
}

function extractApiError(data: UnknownRecord): FormErrorResult | null {
    if (data.success !== false || !isRecord(data.error)) return null;

    const errObj = data.error;
    const code = typeof errObj.code === 'string' ? errObj.code : null;
    const message = typeof errObj.message === 'string' ? errObj.message : 'エラー';

    const parsed = parseApiErrorForUI({ code, message, details: errObj.details });

    const formErrorsString = parsed.kind === 'validation' && 'fieldErrors' in parsed
        ? Object.values(parsed.fieldErrors as Record<string, string>).join(' ')
        : parsed.message;

    return {
        formErrorsString,
        parsedAction: parsed.action as UiAction | undefined,
    };
}

export function useFormErrors(fetcherData: unknown): FormErrorResult {
    const deepData = extractDeepestData(fetcherData);

    if (!isRecord(deepData)) return EMPTY_RESULT;

    const formErrors = extractFormErrors(deepData);
    if (formErrors) return formErrors;

    const apiError = extractApiError(deepData);
    if (apiError) return apiError;

    const fallbackError = extractErrorMessage(deepData, { joinWith: ' ' });
    return fallbackError
        ? { formErrorsString: fallbackError, parsedAction: undefined }
        : EMPTY_RESULT;
}

export default useFormErrors;
