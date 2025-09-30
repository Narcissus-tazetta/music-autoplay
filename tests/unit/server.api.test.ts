/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// API エンドポイントのテスト
describe("API Endpoints", () => {
  let app: express.Application;
  let mockSocketServer: {
    musicDB: Map<string, { id: string; title: string; channelName: string }>;
    io: { emit: (...args: unknown[]) => void } | null;
    init: () => Promise<void>;
    close: () => Promise<void>;
  };
  // mockFileStore intentionally omitted (not used in these route tests)
  let metrics: {
    apiMusics: { calls: number; errors: number; totalMs: number };
    rpcGetAllMusics: { calls: number; errors: number; totalMs: number };
  };

  beforeEach(() => {
    app = express();

    // no-op: file store not required for these endpoint tests

    // Mock SocketServerInstance
    mockSocketServer = {
      musicDB: new Map([
        [
          "test1",
          { id: "test1", title: "Test Song 1", channelName: "Test Channel" },
        ],
        [
          "test2",
          { id: "test2", title: "Test Song 2", channelName: "Test Channel 2" },
        ],
      ]),
      io: { emit: vi.fn() as unknown as (...args: unknown[]) => void },
      init: async () => {},
      close: async () => {},
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
        if (mockSocketServer.musicDB instanceof Map) {
          const list = Array.from(mockSocketServer.musicDB.values());
          const sample = Array.from(mockSocketServer.musicDB.keys()).slice(
            0,
            5,
          );
          const socketInitialized = Boolean(mockSocketServer.io);
          res.json({
            ok: true,
            musics: list,
            meta: {
              count: list.length,
              sample,
              socketInitialized,
              ts: new Date().toISOString(),
            },
          });
          metrics.apiMusics.totalMs += Date.now() - start;
          return;
        }
      } catch {
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
      // parse as unknown then narrow where needed
      const body = JSON.parse(response.text) as unknown;

      expect(body).toMatchObject({
        ok: true,
        musics: expect.any(Array),
        meta: {
          count: expect.any(Number),
          sample: expect.any(Array),
          socketInitialized: true,
          ts: expect.any(String),
        },
      });

      const typed = body as {
        ok: boolean;
        musics: unknown[];
        meta: { count: number; sample: string[] };
      };
      expect(typed.musics).toHaveLength(2);
      expect(typed.meta.count).toBe(2);
      expect(typed.meta.sample).toEqual(["test1", "test2"]);
    });

    it("should return empty musics when socket server has no data", async () => {
      mockSocketServer.musicDB.clear();

      const response = await request(app).get("/api/musics");

      expect(response.status).toBe(200);
      const bodyEmpty = JSON.parse(response.text) as unknown;

      expect(bodyEmpty).toMatchObject({
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
      const metricsBody = JSON.parse(response.text) as unknown;

      expect(metricsBody).toMatchObject({
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
      const socketInfoBody = JSON.parse(response.text) as unknown;

      expect(socketInfoBody).toMatchObject({
        ok: true,
        socket: {
          initialized: true,
          path: "/api/socket.io",
          allowExtensions: false,
          corsOrigins: [],
          serverUrl: expect.stringMatching(/^http:\/\/localhost:\d+$/),
          socketUrl: expect.stringMatching(
            /^http:\/\/localhost:\d+\/api\/socket\.io$/,
          ),
          wsUrl: expect.stringMatching(
            /^ws:\/\/localhost:\d+\/api\/socket\.io$/,
          ),
        },
        timestamp: expect.any(String),
      });
    });
  });
});
