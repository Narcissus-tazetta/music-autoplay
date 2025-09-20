import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// API エンドポイントのテスト
describe("API Endpoints", () => {
    let app: express.Application;
    let mockSocketServer: any;
    let mockFileStore: any;
    let metrics: any;

    beforeEach(() => {
        app = express();

        // Mock FileStore
        mockFileStore = {
            load: vi.fn().mockReturnValue([]),
            add: vi.fn(),
            remove: vi.fn(),
            flush: vi.fn().mockResolvedValue(undefined),
            closeSync: vi.fn(),
        } as any;

        // Mock SocketServerInstance
        mockSocketServer = {
            musicDB: new Map([
                ["test1", { id: "test1", title: "Test Song 1", channelName: "Test Channel" }],
                ["test2", { id: "test2", title: "Test Song 2", channelName: "Test Channel 2" }],
            ]),
            io: { emit: vi.fn() },
            init: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined),
        };

        // Mock metrics
        metrics = {
            apiMusics: { calls: 0, errors: 0, totalMs: 0 },
            rpcGetAllMusics: { calls: 0, errors: 0, totalMs: 0 },
        };

        // Setup API routes (mimicking server.ts logic)
        app.get("/api/musics", (req, res) => {
            const start = Date.now();
            metrics.apiMusics.calls++;
            try {
                if (mockSocketServer && mockSocketServer.musicDB instanceof Map) {
                    const list = Array.from(mockSocketServer.musicDB.values());
                    const sample = Array.from(mockSocketServer.musicDB.keys()).slice(0, 5);
                    const socketInitialized = Boolean(mockSocketServer.io);
                    res.json({
                        ok: true,
                        musics: list,
                        meta: { count: list.length, sample, socketInitialized, ts: new Date().toISOString() },
                    });
                    metrics.apiMusics.totalMs += Date.now() - start;
                    return;
                }
            } catch (e) {
                // fallback
            }
            res.json({
                ok: true,
                musics: [],
                meta: {
                    count: 0,
                    sample: [],
                    socketInitialized: Boolean(mockSocketServer.io),
                    ts: new Date().toISOString(),
                },
            });
            metrics.apiMusics.totalMs += Date.now() - start;
        });

        app.get("/api/metrics", (req, res) => {
            res.json({
                ok: true,
                metrics: {
                    apiMusics: metrics.apiMusics,
                    rpcGetAllMusics: metrics.rpcGetAllMusics,
                },
            });
        });

        app.get("/api/socket-info", (req, res) => {
            try {
                const socketInitialized = Boolean(mockSocketServer.io);
                const socketPath = "/api/socket.io";
                const port = 3000;

                res.json({
                    ok: true,
                    socket: {
                        initialized: socketInitialized,
                        path: socketPath,
                        allowExtensions: false,
                        corsOrigins: [],
                        serverUrl: `http://localhost:${port}`,
                        socketUrl: `http://localhost:${port}${socketPath}`,
                        wsUrl: `ws://localhost:${port}${socketPath}`,
                    },
                    timestamp: new Date().toISOString(),
                });
            } catch (e) {
                res.status(500).json({ ok: false, error: String(e) });
            }
        });
    });

    describe("GET /api/musics", () => {
        it("should return musics with proper structure when socket server has data", async () => {
            const response = await request(app).get("/api/musics");

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                ok: true,
                musics: expect.any(Array),
                meta: {
                    count: expect.any(Number),
                    sample: expect.any(Array),
                    socketInitialized: true,
                    ts: expect.any(String),
                },
            });

            expect(response.body.musics).toHaveLength(2);
            expect(response.body.meta.count).toBe(2);
            expect(response.body.meta.sample).toEqual(["test1", "test2"]);
        });

        it("should return empty musics when socket server has no data", async () => {
            mockSocketServer.musicDB.clear();

            const response = await request(app).get("/api/musics");

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                ok: true,
                musics: [],
                meta: {
                    count: 0,
                    sample: [],
                    socketInitialized: true,
                    ts: expect.any(String),
                },
            });
        });

        it("should increment metrics call counter", async () => {
            const initialCalls = metrics.apiMusics.calls;

            await request(app).get("/api/musics");

            expect(metrics.apiMusics.calls).toBe(initialCalls + 1);
            // totalMs is measured in ms and may be 0 on very fast runs; assert it's a number >= 0
            expect(typeof metrics.apiMusics.totalMs).toBe("number");
            expect(metrics.apiMusics.totalMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe("GET /api/metrics", () => {
        it("should return metrics with proper structure", async () => {
            const response = await request(app).get("/api/metrics");

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                ok: true,
                metrics: {
                    apiMusics: {
                        calls: expect.any(Number),
                        errors: expect.any(Number),
                        totalMs: expect.any(Number),
                    },
                    rpcGetAllMusics: {
                        calls: expect.any(Number),
                        errors: expect.any(Number),
                        totalMs: expect.any(Number),
                    },
                },
            });
        });
    });

    describe("GET /api/socket-info", () => {
        it("should return socket info with proper structure", async () => {
            const response = await request(app).get("/api/socket-info");

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                ok: true,
                socket: {
                    initialized: true,
                    path: "/api/socket.io",
                    allowExtensions: false,
                    corsOrigins: [],
                    serverUrl: expect.stringMatching(/^http:\/\/localhost:\d+$/),
                    socketUrl: expect.stringMatching(/^http:\/\/localhost:\d+\/api\/socket\.io$/),
                    wsUrl: expect.stringMatching(/^ws:\/\/localhost:\d+\/api\/socket\.io$/),
                },
                timestamp: expect.any(String),
            });
        });
    });
});
