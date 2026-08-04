import { isRecord } from '@/shared/utils/typeGuards';
import { extractErrorInfo } from './core';

export interface FormatOptions {
    maxDepth?: number;
    maxLen?: number;
    joinWith?: string;
}

function isUserMessage(str: string): boolean {
    const trimmed = str.trim();

    if (trimmed.length === 0) return false;

    if (
        trimmed.startsWith('status:')
        || trimmed.startsWith('fields:')
        || trimmed.startsWith('url:')
        || trimmed.startsWith('code:')
    ) {
        return false;
    }

    const technicalTerms = ['url', 'error', 'status', 'code', 'fields', 'data'];
    if (technicalTerms.includes(trimmed.toLowerCase())) return false;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false;

    if (trimmed.startsWith('at ') || /^\s*at\s+/m.test(trimmed)) return false;

    return true;
}

export function extractErrorMessage(
    error: unknown,
    opts?: FormatOptions,
): string | undefined {
    const { maxDepth = 3, maxLen = 1000, joinWith = '\n' } = opts ?? {};

    const seen = new WeakSet();
    const userMessages: string[] = [];

    function addMessage(str: string | undefined): void {
        if (!str) return;
        const trimmed = str.trim();
        if (isUserMessage(trimmed)) {
            if (!userMessages.includes(trimmed)) userMessages.push(trimmed);
        }
    }

    function walk(value: unknown, depth: number): void {
        if (userMessages.length >= 10) return;

        if (value == undefined) return;

        if (typeof value === 'string') {
            addMessage(value);
            return;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === 'string') addMessage(item);
                else if (depth < maxDepth) walk(item, depth + 1);
                if (userMessages.length >= 10) break;
            }
            return;
        }

        if (isRecord(value)) {
            if (seen.has(value)) return;
            seen.add(value);

            const priorityFields = ['formErrors', 'message', 'error'];

            for (const field of priorityFields) {
                const fieldValue = value[field];

                if (Array.isArray(fieldValue)) {
                    for (const item of fieldValue) if (typeof item === 'string') addMessage(item);
                } else if (typeof fieldValue === 'string') {
                    addMessage(fieldValue);
                }
            }

            if (userMessages.length === 0 && depth < maxDepth) {
                for (const [key, val] of Object.entries(value)) {
                    if (priorityFields.includes(key)) continue;

                    if (['status', 'url', 'fields', 'code', 'stack'].includes(key)) continue;

                    if (val == undefined) continue;

                    if (Array.isArray(val)) {
                        for (const item of val) if (typeof item === 'string') addMessage(item);
                    } else if (isRecord(val)) walk(val, depth + 1);
                    else if (typeof val === 'string') addMessage(val);
                }
            }
        }
    }

    try {
        walk(error, 0);
    } catch {
        try {
            const info = extractErrorInfo(error);
            addMessage(info.message);
        } catch {
            // skip
        }
    }

    if (userMessages.length === 0) return undefined;

    const joined = userMessages.join(joinWith);
    return joined.length > maxLen ? joined.slice(0, maxLen) + '…' : joined;
}
