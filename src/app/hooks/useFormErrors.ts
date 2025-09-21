import { useMemo } from "react";
import { extractErrorMessage } from "@/shared/utils/formatError";

export function useFormErrors(fetcherData: unknown) {
    const rawFetchData = (fetcherData as unknown) ?? fetcherData;

    const candidate = useMemo(() => {
        if (rawFetchData && typeof rawFetchData === "object" && "result" in (rawFetchData as Record<string, unknown>)) {
            return (rawFetchData as Record<string, unknown>).result;
        }
        return rawFetchData;
    }, [rawFetchData]);

    const formErrorsString = useMemo(() => {
        return (
            extractErrorMessage(candidate, { joinWith: " " }) ??
            extractErrorMessage(fetcherData, { joinWith: " " }) ??
            undefined
        );
    }, [candidate, fetcherData]);

    return { rawFetchData, candidate, formErrorsString } as const;
}

export default useFormErrors;
