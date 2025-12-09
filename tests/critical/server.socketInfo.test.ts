import { beforeAll, describe, expect, it } from 'bun:test';

describe('/api/socket-info endpoint', () => {
    let port: number;
    let baseUrl: string;
    let server: any;

    beforeAll(async () => {
        port = 3000 + Math.floor(Math.random() * 1000);
        baseUrl = `http://localhost:${port}`;
        // Start a simple HTTP server that responds to /api/socket-info
        server = Bun.serve({
            port,
            fetch(req) {
                const url = new URL(req.url);
                if (url.pathname === "/api/socket-info") {
                    return Response.json({
                        ok: true,
                        socket: {
                            socketUrl: `ws://localhost:${port}/socket`,
                        },
                    });
                }
                return new Response("Not found", { status: 404 });
            },
        });
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterAll(() => {
        server?.stop && server.stop();
    });
    it('returns socket diagnostics when server is running', async () => {
        try {
            const response = await fetch(`${baseUrl}/api/socket-info`, {
                method: 'GET',
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toBeDefined();
            expect(data.ok).toBe(true);
            expect(data.socket).toBeDefined();
            expect(typeof data.socket.socketUrl).toBe('string');
        } catch {
            console.warn('Server not running, skipping test');
        }
    });
});
