import { describe, expect, test } from 'bun:test';
import { normalizeApiResponse } from '../../src/shared/utils/api';

describe('API normalization utilities', () => {
    describe('normalizeApiResponse', () => {
        test('normalizes successful response', async () => {
            const resp = new Response(
                JSON.stringify({ data: { id: 1, name: 'test' }, success: true }),
                {
                    status: 200,
                },
            );

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toEqual({ id: 1, name: 'test' });
        });

        test('normalizes error response with code and message', async () => {
            const resp = new Response(
                JSON.stringify({
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
                    success: false,
                }),
                { status: 400 },
            );

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('VALIDATION_ERROR');
                expect(result.error.message).toBe('Invalid input');
            }
        });

        test('normalizes error response with details', async () => {
            const resp = new Response(
                JSON.stringify({
                    error: {
                        code: 'VALIDATION',
                        details: { url: 'Invalid URL' },
                        message: 'Validation failed',
                    },
                    success: false,
                }),
                { status: 422 },
            );

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.details).toEqual({ url: 'Invalid URL' });
        });

        test('handles non-normalized successful response', async () => {
            const resp = new Response(JSON.stringify({ id: 1, name: 'test' }), {
                status: 200,
            });

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(true);
            if (result.success) expect(result.data).toEqual({ id: 1, name: 'test' });
        });

        test('handles non-normalized error response', async () => {
            const resp = new Response(JSON.stringify({ message: 'Not found' }), {
                status: 404,
            });

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('404');
                expect(result.error.message).toContain('request failed');
            }
        });

        test('handles empty response body', async () => {
            const resp = new Response('', { status: 200 });

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(true);
        });

        test('handles invalid JSON', async () => {
            const resp = new Response('invalid json', { status: 200 });

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(true);
        });

        test('handles error without message field', async () => {
            const resp = new Response(JSON.stringify({ error: {}, success: false }), {
                status: 500,
            });

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.message).toBeDefined();
        });

        test('converts numeric error code to string', async () => {
            const resp = new Response(
                JSON.stringify({
                    error: { code: 404, message: 'Not found' },
                    success: false,
                }),
                { status: 404 },
            );

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.code).toBe('404');
        });

        test('handles 500 internal server error', async () => {
            const resp = new Response(
                JSON.stringify({
                    error: { message: 'Internal error' },
                    success: false,
                }),
                {
                    status: 500,
                },
            );

            const result = await normalizeApiResponse(resp);
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error.message).toBe('Internal error');
        });
    });
});
