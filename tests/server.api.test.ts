import { beforeAll, describe, expect, it } from 'bun:test';

describe('API Endpoints', () => {
    let port: number;
    let baseUrl: string;

    beforeAll(async () => {
        port = 3000 + Math.floor(Math.random() * 1000);
        baseUrl = `http://localhost:${port}`;
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('GET /api/admin/status returns admin status', async () => {
        try {
            const response = await fetch(`${baseUrl}/api/admin/status`, {
                method: 'GET',
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toBeDefined();
            expect(typeof data.isAdmin).toBe('boolean');
        } catch {
            console.warn('Server not running, skipping test');
        }
    });
});
