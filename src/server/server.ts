import { createRequestHandler } from '@react-router/express';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import type { RequestHandler } from 'express';
import { Server } from 'socket.io';
import type { ViteDevServer } from 'vite';

import type { C2S, S2C } from '../types/socket';
import { displayApiUsageStats } from './apiUsageDisplay';
import { httpLogger } from './httpLogger';
import { log } from './logger';
import { registerSocketHandlers } from './socketHandlers';
import { clients } from './youtubeState';

import dotenv from 'dotenv';
dotenv.config();

log.server('🚀 Starting Music Auto-Play Server...');
log.server(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
log.server(`🔧 Node.js: ${process.version}`);
log.server(`🔑 YouTube API Key: ${process.env.YOUTUBE_API_KEY ? '✅ Loaded' : '❌ Missing'}`);
log.server(`🔒 Admin Secret: ${process.env.ADMIN_SECRET ? '✅ Loaded' : '❌ Missing'}`);

// 管理者認証が正しく設定されているかのより詳細なチェック
if (process.env.ADMIN_SECRET) {
    const secretLength = process.env.ADMIN_SECRET.length;
    if (secretLength >= 32) log.server(`🔐 Admin Secret validation: ✅ Valid (${secretLength} characters)`);
    else log.warn(`⚠️ Admin Secret validation: Weak (${secretLength} characters, recommended: 32+)`);
} else {
    log.warn('⚠️ Admin Secret not configured - admin features disabled');
}
import type { ServerBuild } from 'react-router';
import { getTodaysApiUsage } from './apiCounter';
const apiUsage = getTodaysApiUsage();
log.apiUsage(`📊 Today's API Usage: ${apiUsage.count} calls`);

let reactRouterHandler: RequestHandler;
let viteDevServer: ViteDevServer | undefined;
if (process.env.NODE_ENV === 'production') {
    log.server('📦 Loading production build...');
    // @ts-expect-error build/server/index.jsの型不足エラーを回避
    const ssrBuild = await import('../../build/server/index.js') as ServerBuild;
    reactRouterHandler = createRequestHandler({ build: ssrBuild });
    log.server('✅ Production build loaded successfully');
} else {
    const { createServer } = await import('vite');

    log.server('🔄 Setting up Vite development server...');
    const vds = await createServer({ server: { middlewareMode: true } });

    reactRouterHandler = createRequestHandler({
        build: () => vds.ssrLoadModule('virtual:react-router/server-build') as Promise<ServerBuild>,
    });
    log.server('✅ Vite development server configured');

    viteDevServer = vds;
}

const port = process.env.PORT || 3000;
log.server(`🌐 Port: ${port}`);

const app = express();
log.server('⚙️  Configuring middleware...');

const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        'https://music-autoplay.onrender.com', // 本番環境
        'https://music-autoplay.onrender.com/', // トレーリングスラッシュ対応
    ]
    : [
        'http://localhost:3000', // 開発環境
        'http://localhost:5173', // Vite開発サーバー
        'http://127.0.0.1:3000', // IPv4ローカル
        'http://127.0.0.1:5173', // Vite IPv4
    ];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        optionsSuccessStatus: 200,
    }),
);

log.server(`🔐 CORS configured for origins: ${allowedOrigins.join(', ')}`);

const server = app.listen(port, () => {
    log.server(
        `🎵 Music Auto-Play Server [${
            process.env.NODE_ENV || 'development'
        }] running at http://localhost:${port} | Socket.IO enabled | ${new Date().toLocaleString('ja-JP')}`,
    );
    log.server(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    log.server('🎯 Ready to accept connections!');
});

app.use(compression());
app.disable('x-powered-by');
log.server('📦 Compression enabled, x-powered-by header disabled');

if (viteDevServer) {
    app.use(viteDevServer.middlewares);
    log.server('🔧 Vite middleware attached');
} else {
    app.use('/assets', express.static('build/client/assets', { immutable: true, maxAge: '1y' }));
    log.server('📁 Static assets serving configured (production)');
}

// Public static files (favicon, etc.)
app.use(express.static('public', { maxAge: '1d' }));
app.use(express.static('build/client', { maxAge: '1h' }));
app.use(httpLogger);
log.server('📝 Static file serving (public + build) and HTTP logging configured');

app.all('*splat', reactRouterHandler);
log.server('🛣️  React Router handler configured');

const io = new Server<C2S, S2C>(server);
log.server('🔌 Socket.IO server initialized');

io.on('connection', socket => {
    registerSocketHandlers(io, socket, clients);
});

displayApiUsageStats();

log.server('🎉 Server initialization complete!');
