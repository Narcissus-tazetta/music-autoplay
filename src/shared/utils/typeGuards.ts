export function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isThenable(v: unknown): v is Promise<unknown> {
    return isObject(v) && typeof v.then === 'function';
}

export function hasOwnProperty(
    obj: Record<string, unknown>,
    key: string,
): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

export function getStructuredClone(): ((x: unknown) => unknown) | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof globalThis === 'object' && globalThis !== null) {
        const g = globalThis as Record<string, unknown>;
        const sc = g['structuredClone'];
        if (typeof sc === 'function') return sc as (x: unknown) => unknown;
    }
    return undefined;
}
