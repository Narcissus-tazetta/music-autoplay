declare global {
    var __simpleMetrics:
        | {
            apiMusics: { calls: number; errors: number; totalMs: number };
            rpcGetAllMusics: { calls: number; errors: number; totalMs: number };
        }
        | undefined;
}
import { getConfigService } from './config/configService';
import { container } from './di/container';
import logger from './logger';
import type { Store } from './persistence';
import { FileStore, MongoHybridStore, MongoStore, PgHybridStore, PgStore } from './persistence';
import CacheService from './services/cacheService';
import ErrorService from './services/errorService';
import MetricsManager from './services/metricsManager';
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

    if (persistenceProvider === 'mongo') {
        const uri = configService.getString('MONGODB_URI');
        if (!uri) throw new Error('PERSISTENCE_PROVIDER=mongo requires MONGODB_URI');
        const dbName = configService.getString('MONGODB_DB_NAME', 'musicReq') ?? 'musicReq';
        const collectionName = configService.getString('MONGODB_COLLECTION', 'musicRequests')
            ?? 'musicRequests';

        const mongo = new MongoStore({ uri, collectionName, dbName });
        await mongo.initialize();
        const initial = await mongo.loadAll();
        fileStore = new MongoHybridStore(mongo, initial);
        closeDb = () => mongo.close();

        logger.info('persistence provider: mongo', {
            dbName,
            collectionName,
        });
    } else if (persistenceProvider === 'pg') {
        const pg = new PgStore();
        await pg.initialize();
        const initial = await pg.loadAll();
        fileStore = new PgHybridStore(pg, initial);
        closeDb = () => pg.close();

        logger.info('persistence provider: pg');
    } else {
        fileStore = new FileStore();
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
            if (typeof fileStore.flush === 'function') {
                await fileStore.flush();
                logger.info('filestore flushed');
            }
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
            } catch (error) {
                logger.warn('fileStore.closeSync failed', { error: error });
            }

            try {
                if (closeDb) await closeDb();
            } catch (error) {
                logger.warn('persistence backend close failed', { error });
            }
        }
    });

    return { appShutdownHandlers, fileStore, metricsManager, socketServer };
}
