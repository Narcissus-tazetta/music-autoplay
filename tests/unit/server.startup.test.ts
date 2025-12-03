/* eslint-disable @typescript-eslint/no-misused-promises */
import express from 'express';
import { createServer, Server } from 'node:http';
import { describe, expect, it } from '../bunTestCompat';
describe('HTTP Server startup and error handling', () => {
    it('emits EADDRINUSE when port already in use', done => {
        const appA = express();
        const srvA = createServer(appA);
        srvA.listen(0, () => {
            const port = (srvA.address() as any).port;
            const appB = express();
            const srvB = createServer(appB);
            srvB.on('error', (err: any) => {
                try {
                    expect(err).toBeDefined();
                    expect(err.code === 'EADDRINUSE').toBe(true);
                    srvA.close(() => {
                        done();
                    });
                } catch (error) {
                    srvA.close(() => {
                        done(error as Error);
                    });
                }
            });
            srvB.listen(port);
        });
    });
});
