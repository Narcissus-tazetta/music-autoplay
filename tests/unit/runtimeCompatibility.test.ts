import routes from '@/app/routes';
import { action as addMusicAction } from '@/app/routes/api/music.add';
import { getAllowedActionOrigins } from '@/server/reactRouter/actionOrigins';
import { serverContext } from '@/shared/types/server';
import { describe, expect, test } from 'bun:test';
import { RouterContextProvider } from 'react-router';

const createRateLimiter = () => ({
    check: () => true,
    consume: () => undefined,
    getOldestAttempt: () => undefined,
});

describe('runtime compatibility', () => {
    test('allowedActionOrigins includes configured production hosts only', () => {
        const origins = getAllowedActionOrigins({
            clientUrl: 'https://music.example.com',
            corsOrigins: 'https://admin.example.com,not-a-url,*',
            nodeEnv: 'production',
            port: 3999,
        });

        expect(origins).toContain('music.example.com');
        expect(origins).toContain('admin.example.com');
        expect(origins).not.toContain('localhost:3999');
        expect(origins).not.toContain('*');
    });

    test('allowedActionOrigins includes local development hosts', () => {
        const origins = getAllowedActionOrigins({
            clientUrl: 'http://localhost:3999',
            corsOrigins: '',
            nodeEnv: 'development',
            port: 3999,
        });

        expect(origins).toContain('localhost:3999');
        expect(origins).toContain('127.0.0.1:3999');
        expect(origins).toContain('0.0.0.0:3999');
        expect(origins).toContain('[::1]:3999');
    });

    test('React Router API routes use slash paths, not legacy dot paths', () => {
        const routePaths = routes.map(route => route.path).filter(Boolean);

        expect(routePaths).toContain('api/music/add');
        expect(routePaths).toContain('api/music/remove');
        expect(routePaths).not.toContain('api/music.add');
        expect(routePaths).not.toContain('api/music.remove');
    });

    test('music add action reads serverContext from RouterContextProvider', async () => {
        const context = new RouterContextProvider();
        let addMusicArgs: unknown[] | undefined;

        context.set(serverContext, {
            httpRateLimiter: createRateLimiter(),
            io: {
                addMusic: (...args: unknown[]) => {
                    addMusicArgs = args;
                    return {};
                },
            },
        } as never);

        const formData = new FormData();
        formData.set('url', 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
        const request = new Request('http://localhost:3999/api/music/add', {
            body: formData,
            method: 'POST',
        });

        const response = await addMusicAction({
            context,
            params: {},
            pattern: '/api/music/add',
            request,
            url: new URL(request.url),
        });

        expect(response.status).toBe(200);
        expect(addMusicArgs?.[0]).toBe('https://www.youtube.com/watch?v=aaaaaaaaaaa');
        expect(addMusicArgs).toBeDefined();
    });
});
