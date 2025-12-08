export interface RetryOptions {
    retries?: number;
    baseMs?: number;
    factor?: number;
}

export async function retry<T>(
    fn: () => Promise<T>,
    opts: RetryOptions = {},
): Promise<T> {
    const retries = opts.retries ?? 3;
    const base = opts.baseMs ?? 200;
    const factor = opts.factor ?? 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            // Intentional sequential await in retry loop.
            // eslint-disable-next-line no-await-in-loop
            return await fn();
        } catch (error) {
            lastErr = error;
            if (attempt === retries) break;
            const wait = base * Math.pow(factor, attempt);
            // eslint-disable-next-line no-await-in-loop
            await new Promise(r => setTimeout(r, wait));
        }
    }
    throw lastErr;
}

export default retry;
