declare global {
    var __simpleMetrics:
        | {
            apiMusics: { calls: number; errors: number; totalMs: number };
            rpcGetAllMusics: { calls: number; errors: number; totalMs: number };
        }
        | undefined;
}
import { SERVER_ENV } from '@/app/env.server';
import { getHistoryService, type HistoryService } from './history/historyService';
import logger from './logger';
import type { Store } from './persistence';
import { createPersistence, registerPersistenceSingletons } from './persistence/provider';
import type { RequestLogService } from './requestLog/requestLogService';
import CacheService from './services/cacheService';
import { MetricsManager, metricsManager } from './services/metricsManager';
import { RateLimiterManager } from './services/rateLimiterManager';
import { YouTubeService } from './services/youtubeService';
import { SocketServerInstance } from './socket';
export interface Metrics {
    apiMusics: { calls: number; errors: number; totalMs: number };
    rpcGetAllMusics: { calls: number; errors: number; totalMs: number };
}

export interface BootstrapResult {
    appShutdownHandlers: (() => Promise<void> | void)[];
    fileStore: Store;
    socketServer: InstanceType<typeof SocketServerInstance>;
    metricsManager: MetricsManager;
    youtubeService: YouTubeService;
}

export async function bootstrap(): Promise<BootstrapResult> {
    const cacheService = new CacheService();

    const persistence = await createPersistence();
    registerPersistenceSingletons(persistence);
    const fileStore: Store = persistence.store;
    const historyService: HistoryService = persistence.historyService;
    const requestLogService: RequestLogService = persistence.requestLogService;
    const closeDb = persistence.close;

    const youtubeService = new YouTubeService(undefined, cacheService);

    const socketServer = new SocketServerInstance(youtubeService, fileStore);

    const appShutdownHandlers: (() => Promise<void> | void)[] = [];
    appShutdownHandlers.push(async () => {
        try {
            try {
                youtubeService.destroy();
            } catch (destroyError) {
                logger.warn('youtubeService.destroy failed', { error: destroyError });
            }
            if (typeof fileStore.flush === 'function') {
                await fileStore.flush();
                logger.info('filestore flushed');
            }
            const managedHistoryService = historyService ?? getHistoryService();
            await managedHistoryService.flush();
            logger.info('historyService flushed');
            await requestLogService.flush();
            logger.info('requestLogService flushed');
            if (closeDb) {
                await closeDb();
                logger.info('persistence backend closed');
            }
        } catch (error) {
            logger.warn('fileStore.flush failed, attempting sync close', {
                error: error,
            });
            try {
                if (typeof fileStore.closeSync === 'function') fileStore.closeSync();
            } catch (closeSyncError) {
                logger.warn('fileStore.closeSync failed', { error: closeSyncError });
            }

            try {
                const managedHistoryService = historyService ?? getHistoryService();
                managedHistoryService.closeSync();
            } catch (historyCloseError) {
                logger.warn('historyService.closeSync failed', { error: historyCloseError });
            }

            try {
                requestLogService.closeSync();
            } catch (requestLogCloseError) {
                logger.warn('requestLogService.closeSync failed', { error: requestLogCloseError });
            }

            try {
                if (closeDb) await closeDb();
            } catch (closeDbError) {
                logger.warn('persistence backend close failed', { error: closeDbError });
            }
        }
    });

    const diagEnabled = SERVER_ENV.DIAG_MEM_ENABLED;
    const diagIntervalMs = SERVER_ENV.DIAG_MEM_LOG_INTERVAL_MS;
    const processWithInternals = process as NodeJS.Process & {
        _getActiveHandles?: () => unknown[];
        _getActiveRequests?: () => unknown[];
        getActiveResourcesInfo?: () => string[];
    };

    const collectRuntimeDiagnostics = (): {
        activeHandleCount?: number;
        activeRequestCount?: number;
        activeResourcesCount?: number;
        activeResourcesTop?: Array<{ count: number; resource: string }>;
    } => {
        const activeHandleCount = processWithInternals._getActiveHandles?.().length;
        const activeRequestCount = processWithInternals._getActiveRequests?.().length;
        const activeResources = processWithInternals.getActiveResourcesInfo?.();

        if (!activeResources) {
            return {
                activeHandleCount,
                activeRequestCount,
            };
        }

        const byType = new Map<string, number>();
        for (const resourceType of activeResources) byType.set(resourceType, (byType.get(resourceType) ?? 0) + 1);

        const activeResourcesTop = Array.from(byType.entries())
            .map(([resource, count]) => ({ count, resource }))
            .toSorted((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            activeHandleCount,
            activeRequestCount,
            activeResourcesCount: activeResources.length,
            activeResourcesTop,
        };
    };

    if (diagEnabled && diagIntervalMs > 0) {
        const timer = setInterval(() => {
            try {
                const mem = process.memoryUsage();
                const runtimeDiagnostics = collectRuntimeDiagnostics();
                const socketDiagnostics = socketServer.getDiagnostics();
                const youtubeDiagnostics = youtubeService.getDiagnostics();
                const rateLimiterStats = RateLimiterManager.getInstance().getStats();
                const totalRateLimiterKeys = rateLimiterStats.reduce((sum: number, s) => sum + s.totalKeys, 0);
                const totalRateLimiterAttempts = rateLimiterStats.reduce((sum: number, s) => sum + s.totalAttempts, 0);

                logger.info('diag.memory', {
                    arrayBuffers: mem.arrayBuffers,
                    external: mem.external,
                    heapTotal: mem.heapTotal,
                    heapUsed: mem.heapUsed,
                    pid: process.pid,
                    platform: process.platform,
                    processArch: process.arch,
                    processVersion: process.version,
                    rss: mem.rss,
                    uptimeSec: Math.round(process.uptime()),
                    activeHandleCount: runtimeDiagnostics.activeHandleCount,
                    activeRequestCount: runtimeDiagnostics.activeRequestCount,
                    activeResourcesCount: runtimeDiagnostics.activeResourcesCount,
                    activeResourcesTop: runtimeDiagnostics.activeResourcesTop,
                    musicDBSize: socketDiagnostics.musicDBSize,
                    rateLimiterKeys: totalRateLimiterKeys,
                    rateLimiterAttempts: totalRateLimiterAttempts,
                    socketConnectedSockets: socketDiagnostics.connectedSockets,
                    socketRoomCount: socketDiagnostics.roomCount,
                    socketTimerCount: socketDiagnostics.timerCount,
                    socketWindowCloseLastEventCount: socketDiagnostics.windowClose.lastEventCount,
                    socketWindowCloseTimerCount: socketDiagnostics.windowClose.timerCount,
                    socketRateLimiterKeys: socketDiagnostics.rateLimiter.socket.totalKeys,
                    socketRateLimiterAttempts: socketDiagnostics.rateLimiter.socket.totalAttempts,
                    httpRateLimiterKeys: socketDiagnostics.rateLimiter.http.totalKeys,
                    httpRateLimiterAttempts: socketDiagnostics.rateLimiter.http.totalAttempts,
                    youtubeCacheSize: youtubeDiagnostics.cacheSize,
                    youtubeMaxEntries: youtubeDiagnostics.maxEntries,
                    youtubeDefaultTtlMs: youtubeDiagnostics.defaultTtlMs,
                    youtubeRequestQueueLength: youtubeDiagnostics.requestQueueLength,
                    youtubeRequestQueueMax: youtubeDiagnostics.requestQueueMax,
                    youtubeQueueProcessing: youtubeDiagnostics.isProcessingQueue,
                    rateLimiterStats,
                });
            } catch (error) {
                logger.warn('diag.memory logging failed', { error: error });
            }
        }, diagIntervalMs);

        appShutdownHandlers.push(() => clearInterval(timer));
        logger.info('diag.memory logging enabled', { intervalMs: diagIntervalMs });
    }

    return { appShutdownHandlers, fileStore, metricsManager, socketServer, youtubeService };
}
