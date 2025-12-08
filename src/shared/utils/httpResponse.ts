import logger from '@/server/logger';
import type { HandlerError } from './errors';
import type { Result } from './errors/result-handlers';

interface JsonResponse {
    success: boolean;
    data?: unknown;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export function respondWithResult<T>(
    r: Result<T, HandlerError>,
    okStatus = 200,
): Response {
    if (r.ok) {
        const body: JsonResponse = { data: r.value, success: true };
        return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' },
            status: okStatus,
        });
    }
    const he = r.error;
    const message = he.message || 'Internal error';
    const code = he.code ?? 'internal_error';
    const errBody = (codeStr: string, msg: string, details?: unknown) =>
        ({
            error: { code: codeStr, details, message: msg },
            success: false,
        }) as JsonResponse;

    if (code === 'validation' || code === 'bad_request' || code === '422') {
        return new Response(
            JSON.stringify(errBody('bad_request', message, he.meta)),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 400,
            },
        );
    }

    if (code === 'unauthorized' || code === '401') {
        return new Response(JSON.stringify(errBody('unauthorized', message)), {
            headers: { 'Content-Type': 'application/json' },
            status: 401,
        });
    }

    if (code === 'forbidden' || code === '403') {
        return new Response(JSON.stringify(errBody('forbidden', message)), {
            headers: { 'Content-Type': 'application/json' },
            status: 403,
        });
    }

    if (code === 'not_found' || code === '404') {
        return new Response(JSON.stringify(errBody('not_found', message)), {
            headers: { 'Content-Type': 'application/json' },
            status: 404,
        });
    }
    logger.warn('respondWithResult mapping to 500', { error: he });
    return new Response(JSON.stringify(errBody('internal_error', message)), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
    });
}

export function respondJsonOk(data: unknown): Response {
    return new Response(JSON.stringify({ data, success: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
    });
}
