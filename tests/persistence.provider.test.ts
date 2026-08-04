import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SERVER_ENV } from '../src/server/env.server';
import { getHistoryService, HistoryService } from '../src/server/history/historyService';
import { FileStore } from '../src/server/persistence/file';
import { MongoStore } from '../src/server/persistence/mongo';
import { createPersistence, registerPersistenceSingletons } from '../src/server/persistence/provider';
import { getRequestLogService, RequestLogService } from '../src/server/requestLog/requestLogService';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from './bunTestCompat';

/**
 * createPersistence is what wires PERSISTENCE_PROVIDER to an actual backend, so a mistake
 * here swaps the whole storage layer out from under the server. SERVER_ENV is read inside
 * the call rather than at import time, which lets these tests swap the provider per case.
 *
 * The file branch only constructs its stores - JsonFileStore is lazy and touches the disk
 * on first read/flush - so nothing here writes to the real data/ directory.
 */
type MutableEnv = Record<string, unknown>;

const envKeys = [
    'PERSISTENCE_PROVIDER',
    'MONGODB_URI',
    'MONGODB_DB_NAME',
    'MONGODB_COLLECTION',
    'MONGODB_REQUEST_LOG_COLLECTION',
] as const;

describe('createPersistence', () => {
    let saved: Record<string, unknown>;
    let tmpDir: string;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'persistence-provider-'));
    });

    afterAll(() => {
        // Leave the process-wide singletons pointing at the scratch directory rather than at
        // data/, so a later test that reaches for them cannot write to the real files.
        registerPersistenceSingletons({
            historyService: new HistoryService(path.join(tmpDir, 'history.json')),
            requestLogService: new RequestLogService(path.join(tmpDir, 'request-logs.json')),
            store: new FileStore(path.join(tmpDir, 'musicRequests.json')),
        });
        fs.rmSync(tmpDir, { force: true, recursive: true });
    });

    beforeEach(() => {
        saved = {};
        for (const key of envKeys) saved[key] = (SERVER_ENV as MutableEnv)[key];
    });

    afterEach(() => {
        for (const key of envKeys) (SERVER_ENV as MutableEnv)[key] = saved[key];
    });

    describe('file provider', () => {
        beforeEach(() => {
            (SERVER_ENV as MutableEnv).PERSISTENCE_PROVIDER = 'file';
        });

        it('returns a FileStore bundle with no close hook', async () => {
            const bundle = await createPersistence();

            expect(bundle.store).toBeInstanceOf(FileStore);
            expect(bundle.historyService).toBeDefined();
            expect(bundle.requestLogService).toBeDefined();
            // Nothing to tear down: the file stores hold no connection.
            expect(bundle.close).toBeUndefined();
        });

        it('registerPersistenceSingletons installs the bundle instances', () => {
            // Deliberately NOT the bundle from createPersistence(): its services default to
            // data/history.json and data/request-logs.json, and installing those as the
            // process-wide singletons leaks real-data-backed stores into every test that runs
            // afterwards. Point them at a scratch directory instead.
            const bundle = {
                historyService: new HistoryService(path.join(tmpDir, 'history.json')),
                requestLogService: new RequestLogService(path.join(tmpDir, 'request-logs.json')),
                store: new FileStore(path.join(tmpDir, 'musicRequests.json')),
            };

            registerPersistenceSingletons(bundle);

            expect(getHistoryService()).toBe(bundle.historyService);
            expect(getRequestLogService()).toBe(bundle.requestLogService);
        });
    });

    describe('mongo provider', () => {
        it('rejects when MONGODB_URI is missing', async () => {
            (SERVER_ENV as MutableEnv).PERSISTENCE_PROVIDER = 'mongo';
            (SERVER_ENV as MutableEnv).MONGODB_URI = undefined;

            await expect(createPersistence()).rejects.toThrow(
                'PERSISTENCE_PROVIDER=mongo requires MONGODB_URI',
            );
        });

        describe('against a real mongod', () => {
            let mongod: MongoMemoryServer | null = null;

            beforeEach(async () => {
                mongod = await MongoMemoryServer.create();
                (SERVER_ENV as MutableEnv).PERSISTENCE_PROVIDER = 'mongo';
                (SERVER_ENV as MutableEnv).MONGODB_URI = mongod.getUri();
                (SERVER_ENV as MutableEnv).MONGODB_DB_NAME = 'providerTestDb';
                (SERVER_ENV as MutableEnv).MONGODB_COLLECTION = 'musicRequests';
                (SERVER_ENV as MutableEnv).MONGODB_REQUEST_LOG_COLLECTION = 'requestLogs';
            });

            afterEach(async () => {
                if (mongod) {
                    await mongod.stop();
                    mongod = null;
                }
            });

            it('builds a mongo-backed bundle that round-trips a music item', async () => {
                const bundle = await createPersistence();

                try {
                    expect(bundle.store).toBeDefined();
                    expect(bundle.close).toBeInstanceOf(Function);
                    expect(bundle.store.load()).toEqual([]);

                    const music = {
                        channelId: 'UCtest',
                        channelName: 'Test Channel',
                        duration: 'PT3M30S',
                        id: 'dQw4w9WgXcQ',
                        title: 'Test Song',
                    };
                    await bundle.store.add(music);

                    // The hybrid store answers reads from memory, so re-reading it would pass
                    // even if the mongo write silently failed. Read the collection back through
                    // an independent MongoStore to prove the row actually reached the database.
                    expect(bundle.store.load()).toEqual([music]);

                    const verifier = new MongoStore({
                        collectionName: 'musicRequests',
                        dbName: 'providerTestDb',
                        uri: mongod!.getUri(),
                    });
                    await verifier.initialize();
                    try {
                        const persisted = await verifier.loadAll();
                        expect(persisted).toHaveLength(1);
                        // MongoStore stamps updatedAt on write, so the mongo backend returns a
                        // wider row than the file backend does. Any consolidation of the two
                        // has to keep this difference (or unify it) deliberately.
                        expect(persisted[0]).toMatchObject(music);
                        expect(persisted[0]).toHaveProperty('updatedAt');
                    } finally {
                        await verifier.close();
                    }
                } finally {
                    await bundle.close?.();
                }
            });

            it('close tears the bundle down without throwing', async () => {
                const bundle = await createPersistence();

                expect(bundle.close).toBeInstanceOf(Function);
                await expect(bundle.close?.()).resolves.toBeUndefined();
            });
        });
    });
});
