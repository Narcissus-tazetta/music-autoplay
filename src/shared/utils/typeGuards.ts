export function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function hasOwnProperty(
    obj: Record<string, unknown>,
    key: string,
): boolean {
    return Object.hasOwn(obj, key);
}

export function getStructuredClone(): ((x: unknown) => unknown) | undefined {
    if (typeof globalThis === 'object' && globalThis !== null) {
        const g = globalThis as Record<string, unknown>;
        const sc = g['structuredClone'];
        if (typeof sc === 'function') return sc as (x: unknown) => unknown;
    }
    return undefined;
}
