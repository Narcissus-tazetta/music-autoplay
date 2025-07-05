import { createRequestHandler } from '@react-router/express';
import type { ServerBuild } from 'react-router';
import { Server } from 'socket.io';

import compression from 'compression';
import express from 'express';
import morgan from 'morgan';

import type { C2S, S2C } from '../shared/types/socket';
import { setupSocketHandlers } from './socketHandlers';

import dotenv from 'dotenv';
dotenv.config();

if (!process.env.YOUTUBE_API_KEY) {
    console.error('❌ YouTube API Key is missing! Please set YOUTUBE_API_KEY in your .env file.');
    process.exit(1);
}
if (!process.env.ADMIN_SECRET) {
    console.error('❌ Admin Secret is missing! Please set ADMIN_SECRET in your .env file.');
    process.exit(1);
}
if (process.env.ADMIN_SECRET.length < 32) {
    console.warn(
        '⚠️ Admin Secret is weak! It should be at least 32 characters long for better security. Please update it in your .env file.',
    );
}

const app = express();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    console.info(
        `Server[${process.env.NODE_ENV || 'development'}] running at ${port} | ${new Date().toLocaleString('ja-JP')}`,
    );
});

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
    }),
);

const io = new Server<C2S, S2C>(server);
setupSocketHandlers(io);
