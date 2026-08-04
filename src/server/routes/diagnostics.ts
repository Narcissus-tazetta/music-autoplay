import { SERVER_ENV } from '@/server/env.server';
import { type RequestHandler, Router } from 'express';
import { requireAdmin } from '../middleware/requireRole';
import { metricsManager } from '../services/metricsManager';
import { RateLimiterManager } from '../services/rateLimiterManager';
import type { YouTubeService } from '../services/youtubeService';
import type { SocketServerInstance } from '../socket/socketServer';

interface DiagnosticsDeps {
    socketServer: SocketServerInstance;
    youtubeService: YouTubeService;
}

export function createDiagnosticsRouter({ socketServer, youtubeService }: DiagnosticsDeps): Router {
    const router = Router();

    router.get('/metrics', (_req, res) => {
        const metrics = metricsManager.getMetrics();
        res.json({
            data: { apiMusics: metrics.apiMusics, rpcGetAllMusics: metrics.rpcGetAllMusics },
            status: 'ok',
        });
    });

    router.get('/socket-info', (_req, res) => {
        const corsOrigins = (SERVER_ENV.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
        res.json({
            ok: true,
            socket: {
                corsOrigins,
                serverUrl: `http://localhost:${SERVER_ENV.PORT}`,
                socketUrl: `http://localhost:${SERVER_ENV.PORT}${SERVER_ENV.SOCKET_PATH}`,
                wsUrl: `ws://localhost:${SERVER_ENV.PORT}${SERVER_ENV.SOCKET_PATH}`,
            },
            timestamp: new Date().toISOString(),
        });
    });

    // The feature flag is checked ahead of the auth guard so a disabled endpoint looks absent
    // to everyone. Returning 401 first would tell an anonymous caller that the route exists.
    // This also preserves the response codes the endpoint had before the router split.
    const requireDiagnosticsEnabled: RequestHandler = (_req, res, next) => {
        if (!SERVER_ENV.DIAG_MEM_ENABLED) {
            res.status(404).json({ error: 'disabled', ok: false });
            return;
        }
        next();
    };

    router.get('/admin/diag/memory', requireDiagnosticsEnabled, requireAdmin, (req, res) => {
        if (SERVER_ENV.DIAG_MEM_REQUIRE_ADMIN_SECRET) {
            const headerSecret = req.headers['x-admin-secret'];
            if (typeof headerSecret !== 'string' || headerSecret !== SERVER_ENV.ADMIN_SECRET) {
                res.status(403).json({ error: 'forbidden', ok: false });
                return;
            }
        }

        const mem = process.memoryUsage();
        const processWithInternals = process as NodeJS.Process & {
            _getActiveHandles?: () => unknown[];
            _getActiveRequests?: () => unknown[];
            getActiveResourcesInfo?: () => string[];
        };
        const activeResources = processWithInternals.getActiveResourcesInfo?.();

        res.json({
            data: {
                memory: {
                    arrayBuffers: mem.arrayBuffers,
                    external: mem.external,
                    heapTotal: mem.heapTotal,
                    heapUsed: mem.heapUsed,
                    rss: mem.rss,
                },
                process: {
                    activeHandleCount: processWithInternals._getActiveHandles?.().length,
                    activeRequestCount: processWithInternals._getActiveRequests?.().length,
                    activeResourcesCount: activeResources?.length,
                    pid: process.pid,
                    uptimeSec: Math.round(process.uptime()),
                },
                rateLimiters: RateLimiterManager.getInstance().getStats(),
                socket: socketServer.getDiagnostics(),
                timestamp: new Date().toISOString(),
                youtube: youtubeService.getDiagnostics(),
            },
            ok: true,
        });
    });

    return router;
}
