import { SERVER_ENV } from '@/server/env.server';
import { HistoryService, setHistoryService } from '../history/historyService';
import logger from '../logger.server';
import { RequestLogService, setRequestLogService } from '../requestLog/requestLogService';
import { FileStore } from './file';
import type { Store } from './types';

export interface PersistenceBundle {
    store: Store;
    historyService: HistoryService;
    requestLogService: RequestLogService;
    close?: () => Promise<void>;
}

/**
 * Picks the persistence backend named by PERSISTENCE_PROVIDER.
 *
 * The mongodb driver is pulled in with `await import` rather than a top-level import:
 * the barrel used to re-export every store, so booting with the default `file` provider
 * still loaded MongoClient into memory.
 */
export async function createPersistence(): Promise<PersistenceBundle> {
    const provider = SERVER_ENV.PERSISTENCE_PROVIDER;

    if (provider === 'mongo') {
        const uri = SERVER_ENV.MONGODB_URI;
        if (!uri) throw new Error('PERSISTENCE_PROVIDER=mongo requires MONGODB_URI');

        const dbName = SERVER_ENV.MONGODB_DB_NAME;
        const collectionName = SERVER_ENV.MONGODB_COLLECTION;
        const requestLogCollectionName = SERVER_ENV.MONGODB_REQUEST_LOG_COLLECTION;

        const [{ MongoClient }, { MongoHybridStore, MongoStore }, historyMod, requestLogMod] = await Promise.all([
            import('mongodb'),
            import('./mongo'),
            import('../history/historyMongoStore'),
            import('../requestLog/requestLogMongoStore'),
        ]);

        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });

        const mongo = new MongoStore({ client, collectionName, dbName, uri });
        await mongo.initialize();
        const store = new MongoHybridStore(mongo, await mongo.loadAll());

        const historyMongo = new historyMod.HistoryMongoStore({ client, collectionName: 'history', dbName, uri });
        await historyMongo.initialize();
        const historyService = new HistoryService(
            new historyMod.HistoryMongoHybridStore(historyMongo, await historyMongo.loadAll()),
        );

        const requestLogMongo = new requestLogMod.RequestLogMongoStore({
            client,
            collectionName: requestLogCollectionName,
            dbName,
            uri,
        });
        await requestLogMongo.initialize();
        const requestLogService = new RequestLogService(
            new requestLogMod.RequestLogMongoHybridStore(requestLogMongo, await requestLogMongo.loadAll()),
        );

        logger.info('persistence provider: mongo', {
            collectionName,
            dbName,
            historyCollection: 'history',
            requestLogCollection: requestLogCollectionName,
        });

        return {
            close: async () => {
                await Promise.all([mongo.close(), historyMongo.close(), requestLogMongo.close()]);
                await client.close();
            },
            historyService,
            requestLogService,
            store,
        };
    }

    logger.info('persistence provider: file');
    return {
        historyService: new HistoryService(),
        requestLogService: new RequestLogService(),
        store: new FileStore(),
    };
}

/** Installs the module-level singletons the rest of the server reads from. */
export function registerPersistenceSingletons(bundle: PersistenceBundle): void {
    setHistoryService(bundle.historyService);
    setRequestLogService(bundle.requestLogService);
}
