import express from 'express';
import type { AddressInfo } from 'node:net';
import { configureApp } from '../src/server/configureApp';
import { describe, expect, it } from './bunTestCompat';

describe('GET /healthz', () => {
    it('answers 200 ok without caching', async () => {
        const app = express();
        // CI runs tests without `bun run build`, so the production build import must not be reached.
        await configureApp(app, () => null, { middlewares: express.Router(), ssrLoadModule: async () => ({}) });
        const server = app.listen(0);
        try {
            const { port } = server.address() as AddressInfo;
            const res = await fetch(`http://127.0.0.1:${port}/healthz`);
            expect(res.status).toBe(200);
            expect(await res.text()).toBe('ok');
            expect(res.headers.get('cache-control')).toBe('no-store');
        } finally {
            server.close();
        }
    });
});
