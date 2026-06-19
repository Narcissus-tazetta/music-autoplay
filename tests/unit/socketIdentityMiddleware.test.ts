import { hashRequesterId, resolveRequesterIdentity } from '@/app/requesterIdentity.server';
import { anonymousIdCookie } from '@/app/sessions.server';
import { registerSocketIdentityMiddleware } from '@/server/socket/middleware/socketIdentityMiddleware';
import { describe, expect, test } from 'bun:test';
import { createServer } from 'node:http';
import { Server as IOServer } from 'socket.io';
import Client from 'socket.io-client';

const TEST_ANON_ID = '660e8400-e29b-41d4-a716-446655440001';

describe('socketIdentityMiddleware', () => {
    test('browser 接続で Cookie から requesterHash を socket.data に設定する', async () => {
        const httpServer = createServer();
        const io = new IOServer(httpServer, {
            path: '/api/socket.io',
        });
        registerSocketIdentityMiddleware(io);

        const anonCookie = await anonymousIdCookie.serialize(TEST_ANON_ID);
        const cookieHeader = anonCookie.split(';')[0];

        await new Promise<void>(resolve => {
            io.on('connection', socket => {
                expect(socket.data.requesterHash).toBe(hashRequesterId(TEST_ANON_ID));
                expect(socket.data.requesterName).toBe('660e8400...');
                socket.disconnect();
                resolve();
            });

            httpServer.listen(0, () => {
                const port = (httpServer.address() as { port: number }).port;
                const client = Client(`http://localhost:${port}`, {
                    extraHeaders: {
                        cookie: cookieHeader,
                        origin: 'http://localhost:3000',
                    },
                    path: '/api/socket.io',
                    transports: ['websocket'],
                });
                client.on('connect', () => {
                    client.close();
                });
            });
        });

        io.close();
        httpServer.close();
    });

    test('extension 接続では Cookie identity を設定しない', async () => {
        const httpServer = createServer();
        const io = new IOServer(httpServer, {
            path: '/api/socket.io',
        });
        registerSocketIdentityMiddleware(io);

        const anonCookie = await anonymousIdCookie.serialize(TEST_ANON_ID);
        const cookieHeader = anonCookie.split(';')[0];

        await new Promise<void>(resolve => {
            io.on('connection', socket => {
                expect(socket.data.requesterHash).toBeUndefined();
                expect(socket.data.clientSource).toBe('extension');
                socket.disconnect();
                resolve();
            });

            httpServer.listen(0, () => {
                const port = (httpServer.address() as { port: number }).port;
                const client = Client(`http://localhost:${port}`, {
                    extraHeaders: {
                        cookie: cookieHeader,
                        origin: 'chrome-extension://test-extension-id',
                    },
                    path: '/api/socket.io',
                    transports: ['websocket'],
                });
                client.on('connect', () => {
                    client.close();
                });
            });
        });

        io.close();
        httpServer.close();
    });

    test('resolveRequesterIdentity と middleware の hash が一致する', async () => {
        const anonCookie = await anonymousIdCookie.serialize(TEST_ANON_ID);
        const cookieHeader = anonCookie.split(';')[0];
        const identity = await resolveRequesterIdentity(cookieHeader);
        expect(identity.requesterHash).toBe(hashRequesterId(TEST_ANON_ID));
    });
});
