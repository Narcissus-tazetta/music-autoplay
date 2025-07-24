import { createRequestHandler } from '@react-router/express';
import type { ServerBuild } from 'react-router';

import compression from 'compression';
import express from 'express';
import morgan from 'morgan';

import { SocketServerInstance } from '@/server/socket';
import type { ServerContext } from '@/shared/types/server';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    console.info(
        `Server[${process.env.NODE_ENV || 'development'}] running at ${port} | ${new Date().toLocaleString('ja-JP')}`,
    );
});
const io = new SocketServerInstance(server);

app.use(compression());
app.disable('x-powered-by');

const viteDevServer = process.env.NODE_ENV === 'production'
    ? null
    : await import('vite').then(vite =>
        vite.createServer(
            { server: { middlewareMode: true } },
        )
    );
if (viteDevServer) {
    app.use(
        viteDevServer.middlewares,
    );
} else {
    app.use('/assets', express.static('build/client/assets', { immutable: true, maxAge: '1y' }));
}

app.use(express.static('build/client', { maxAge: '1h' }));
app.use(morgan('tiny'));

app.all(
    '*splat',
    createRequestHandler({
        build: viteDevServer
            ? () => viteDevServer.ssrLoadModule('virtual:react-router/server-build') as Promise<ServerBuild>
            // @ts-expect-error ../../build/server/index.jsの型不足エラーを回避
            : await import('../../build/server/index.js') as ServerBuild,
        getLoadContext: () => (
            {
                io,
            } satisfies ServerContext
        ),
    }),
);
