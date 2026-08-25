import { SERVER_ENV } from '@/server/env.server';
import { getHistoryService, type HistoryService } from './history/historyService';
import logger from './logger.server';
import type { Store } from './persistence';
import { createPersistence, registerPersistenceSingletons } from './persistence/provider';
import type { RequestLogService } from './requestLog/requestLogService';
import { MetricsManager, metricsManager } from './services/metricsManager';
import { RateLimiterManager } from './services/rateLimiterManager';
import { YouTubeService } from './services/youtubeService';
import { SocketServerInstance } from './socket/socketServer';
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
    const persistence = await createPersistence();
    registerPersistenceSingletons(persistence);
    const fileStore: Store = persistence.store;
    const historyService: HistoryService = persistence.historyService;
    const requestLogService: RequestLogService = persistence.requestLogService;
    const closeDb = persistence.close;

    const youtubeService = new YouTubeService();

    const socketServer = new SocketServerInstance(youtubeService, fileStore);

    const appShutdownHandlers: (() => Promise<void> | void)[] = [];

    /**
     * Each store is drained independently: one backend failing must not skip the others, and
     * the synchronous close is the last-resort path for when the async flush cannot finish.
     */
    const drain = async (label: string, flush: () => Promise<void> | void, closeSync?: () => void) => {
        try {
            await flush();
            logger.info(`${label} flushed`);
        } catch (error) {
            logger.warn(`${label} flush failed, attempting sync close`, { error });
            try {
                closeSync?.();
            } catch (closeError) {
                logger.warn(`${label} sync close failed`, { error: closeError });
            }
        }
    };

    appShutdownHandlers.push(async () => {
        youtubeService.destroy();
        await drain('fileStore', () => fileStore.flush?.(), () => fileStore.closeSync?.());
        await drain(
            'historyService',
            () => (historyService ?? getHistoryService()).flush(),
            () => (historyService ?? getHistoryService()).closeSync(),
        );
        await drain('requestLogService', () => requestLogService.flush(), () => requestLogService.closeSync());
        if (closeDb) await drain('persistence backend', closeDb);
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
