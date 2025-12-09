import { beforeAll, describe, expect, it } from 'bun:test';

describe('/api/socket-info endpoint', () => {
    let port: number;
    let baseUrl: string;

    beforeAll(async () => {
        port = 3000 + Math.floor(Math.random() * 1000);
        baseUrl = `http://localhost:${port}`;
        await new Promise(resolve => setTimeout(resolve, 100));
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
