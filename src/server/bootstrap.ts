declare global {
    var __simpleMetrics:
        | {
            apiMusics: { calls: number; errors: number; totalMs: number };
            rpcGetAllMusics: { calls: number; errors: number; totalMs: number };
        }
        | undefined;
}
import { MongoClient } from 'mongodb';
import { getConfigService } from './config/configService';
import { container } from './di/container';
import { HistoryMongoHybridStore, HistoryMongoStore } from './history/historyMongoStore';
import { getHistoryService, HistoryService, setHistoryService } from './history/historyService';
import logger from './logger';
import type { Store } from './persistence';
import { FileStore, MongoHybridStore, MongoStore, PgHybridStore, PgStore } from './persistence';
import CacheService from './services/cacheService';
import ErrorService from './services/errorService';
import MetricsManager from './services/metricsManager';
import { RateLimiterManager } from './services/rateLimiterManager';
import retry from './services/retryService';
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
    const configService = getConfigService();
    const errorService = new ErrorService();
    const cacheService = new CacheService();

    const persistenceProvider = (configService.getString(
        'PERSISTENCE_PROVIDER',
        'file',
    ) ?? 'file') as 'file' | 'pg' | 'mongo';

    let fileStore: Store;
    let closeDb: (() => Promise<void>) | undefined;
    let historyService: HistoryService;

    if (persistenceProvider === 'mongo') {
        const uri = configService.getString('MONGODB_URI');
        if (!uri) throw new Error('PERSISTENCE_PROVIDER=mongo requires MONGODB_URI');
        const dbName = configService.getString('MONGODB_DB_NAME', 'musicReq') ?? 'musicReq';
        const collectionName = configService.getString('MONGODB_COLLECTION', 'musicRequests')
            ?? 'musicRequests';
        const client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 5_000,
        });

        const mongo = new MongoStore({ uri, collectionName, dbName, client });
        await mongo.initialize();
        const initial = await mongo.loadAll();
        fileStore = new MongoHybridStore(mongo, initial);

        const historyMongo = new HistoryMongoStore({
            uri,
            dbName,
            collectionName: 'history',
            client,
        });
        await historyMongo.initialize();
        const historyInitial = await historyMongo.loadAll();
        historyService = new HistoryService(new HistoryMongoHybridStore(historyMongo, historyInitial));
        setHistoryService(historyService);

        closeDb = async () => {
            await Promise.all([mongo.close(), historyMongo.close()]);
            await client.close();
        };

        logger.info('persistence provider: mongo', {
            dbName,
            collectionName,
            historyCollection: 'history',
        });
    } else if (persistenceProvider === 'pg') {
        const pg = new PgStore();
        await pg.initialize();
        const initial = await pg.loadAll();
        fileStore = new PgHybridStore(pg, initial);
        closeDb = () => pg.close();
        historyService = new HistoryService();
        setHistoryService(historyService);

        logger.info('persistence provider: pg');
    } else {
        fileStore = new FileStore();
        historyService = new HistoryService();
        setHistoryService(historyService);
        logger.info('persistence provider: file');
    }

    const youtubeService = new YouTubeService(undefined, configService, cacheService);
    const metricsManager = new MetricsManager();

    const socketServer = new SocketServerInstance(youtubeService, fileStore);

    container.register('fileStore', () => fileStore);
    container.register('socketServer', () => socketServer);
    container.register('youtubeService', () => youtubeService);
    container.register('configService', () => configService);
    container.register('errorService', () => errorService);
    container.register('cacheService', () => cacheService);
    container.register('retryService', () => retry);
    container.register('metricsManager', () => metricsManager);

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
                if (closeDb) await closeDb();
            } catch (closeDbError) {
                logger.warn('persistence backend close failed', { error: closeDbError });
            }
        }
    });

    const diagEnabled = configService.getBoolean('DIAG_MEM_ENABLED', true);
    const diagIntervalMs = configService.getNumber('DIAG_MEM_LOG_INTERVAL_MS', 30_000) ?? 30_000;
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
