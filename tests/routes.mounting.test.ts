import { afterAll, describe, expect, it } from 'bun:test';
import express from 'express';
import type { Server } from 'node:http';
import { errorHandler } from '../src/server/middleware/errorHandler';
import { adminRouter } from '../src/server/routes/admin';
import { createDiagnosticsRouter } from '../src/server/routes/diagnostics';
import { requestLogsRouter } from '../src/server/routes/requestLogs';
import type { YouTubeService } from '../src/server/services/youtubeService';
import type { SocketServerInstance } from '../src/server/socket/socketServer';

/**
 * server.ts mounts three routers on overlapping prefixes:
 *   /api  ->  diagnostics   (owns /admin/diag/memory)
 *   /api/admin              (owns /login, /logout, /status)
 *   /api/admin/request-logs (owns /, /query, /:hashPrefix)
 *
 * Express resolves these by registration order and a miss in one router falls through to the
 * next. That is easy to break silently when routes move, so pin the routing and the guards.
 */
const socketServerStub = {
    getDiagnostics: () => ({
        connectedSockets: 0,
        musicDBSize: 0,
        rateLimiter: { http: { totalAttempts: 0, totalKeys: 0 }, socket: { totalAttempts: 0, totalKeys: 0 } },
        remoteStatusType: 'closed' as const,
        roomCount: 0,
        timerCount: 0,
        windowClose: { lastEventCount: 0, timerCount: 0 },
    }),
} as unknown as SocketServerInstance;

const youtubeServiceStub = {
    getDiagnostics: () => ({ cacheSize: 0 }),
} as unknown as YouTubeService;

function startApp(): Promise<{ base: string; server: Server }> {
    const app = express();
    app.use('/api', createDiagnosticsRouter({ socketServer: socketServerStub, youtubeService: youtubeServiceStub }));
    app.use('/api/admin', adminRouter);
    app.use('/api/admin/request-logs', requestLogsRouter);
    app.use(errorHandler);

    return new Promise(resolve => {
        const server = app.listen(0, () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            resolve({ base: `http://127.0.0.1:${port}`, server });
        });
    });
}

describe('API router mounting', () => {
    const servers: Server[] = [];
    afterAll(() => {
        for (const s of servers) s.close();
    });

    async function withApp<T>(fn: (base: string) => Promise<T>): Promise<T> {
        const { base, server } = await startApp();
        servers.push(server);
        return fn(base);
    }

    it('serves the unauthenticated diagnostics routes', async () => {
        await withApp(async base => {
            const metrics = await fetch(`${base}/api/metrics`);
            expect(metrics.status).toBe(200);
            expect(await metrics.json()).toMatchObject({ status: 'ok' });

            const socketInfo = await fetch(`${base}/api/socket-info`);
            expect(socketInfo.status).toBe(200);
            expect(await socketInfo.json()).toMatchObject({ ok: true });
        });
    }, 20_000);

    it('reaches /api/admin/status without being swallowed by the diagnostics router', async () => {
        await withApp(async base => {
            const res = await fetch(`${base}/api/admin/status`);
            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ isAdmin: false, roles: [] });
        });
    }, 20_000);

    it('guards every request-logs route with the pathfinder role', async () => {
        await withApp(async base => {
            const paths: [string, RequestInit][] = [
                ['/api/admin/request-logs', {}],
                ['/api/admin/request-logs/abcd1234', {}],
                [
                    '/api/admin/request-logs/query',
                    {
                        body: JSON.stringify({ hashPrefix: 'abcd' }),
                        headers: { 'Content-Type': 'application/json' },
                        method: 'POST',
                    },
                ],
            ];

            for (const [path, init] of paths) {
                // oxlint-disable-next-line no-await-in-loop
                const res = await fetch(`${base}${path}`, init);
                expect(res.status).toBe(401);
                // no-store is applied before the guard, so it covers the 401 too
                expect(res.headers.get('cache-control')).toBe('no-store');
            }
        });
    }, 20_000);

    it('hides diag/memory behind 404 for anonymous callers when disabled', async () => {
        // SERVER_ENV is frozen at import, so the flag has to be set before the module loads.
        // A disabled endpoint must look absent to everyone: answering 401 first would reveal
        // that the route exists.
        const script = `
            const express = (await import('express')).default;
            const { createDiagnosticsRouter } = await import('${import.meta.dir}/../src/server/routes/diagnostics.ts');
            const app = express();
            app.use('/api', createDiagnosticsRouter({ socketServer: {}, youtubeService: {} }));
            const server = app.listen(0, async () => {
                const res = await fetch('http://127.0.0.1:' + server.address().port + '/api/admin/diag/memory');
                process.stdout.write('<<STATUS>>' + res.status);
                server.close();
            });
        `;
        const proc = Bun.spawn(['bun', '-e', script], {
            env: { ...process.env, DIAG_MEM_ENABLED: 'false', NODE_ENV: 'test' },
            stderr: 'pipe',
            stdout: 'pipe',
        });
        const [out] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
        const status = out.slice(out.lastIndexOf('<<STATUS>>') + '<<STATUS>>'.length).trim();
        expect(status).toBe('404');
    }, 30_000);

    it('guards diag/memory and rejects cross-origin admin logins', async () => {
        await withApp(async base => {
            // DIAG_MEM_ENABLED defaults to true, so the flag gate passes and the auth guard answers.
            const diag = await fetch(`${base}/api/admin/diag/memory`);
            expect(diag.status).toBe(401);

            const noOrigin = await fetch(`${base}/api/admin/login`, {
                body: JSON.stringify({ password: 'x', username: 'x' }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
            });
            expect(noOrigin.status).toBe(403);

            const crossOrigin = await fetch(`${base}/api/admin/login`, {
                body: JSON.stringify({ password: 'x', username: 'x' }),
                headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
                method: 'POST',
            });
            expect(crossOrigin.status).toBe(403);
        });
    }, 20_000);
});
