describe("API Endpoints (placeholder)", () => {
  it("sanity: test harness works", () => {
    expect(true).toBe(true);
  });
});
describe("API Endpoints (placeholder)", () => {
  it("sanity: test harness works", () => {
    expect(true).toBe(true);
  });
});
import express from "express";
import request from "supertest";
import configureApp from "../../src/server/configureApp";
import { describe, expect, it } from "../bunTestCompat";

describe("API Endpoints", () => {
  it("GET /api/musics returns musics from io.musicDB when present", async () => {
    const musicDB = new Map<string, unknown>();
    musicDB.set("m1", { id: "m1", title: "Song 1" } as Record<string, unknown>);
    musicDB.set("m2", { id: "m2", title: "Song 2" } as Record<string, unknown>);
    const app = express();
    const getIo = () =>
      ({ musicDB }) as unknown as {
        emit: (...args: unknown[]) => void;
        musicDB: Map<string, unknown>;
      };
    const fakeVite = {
      ssrLoadModule: async (_: string) => ({}),
      middlewares: (req: any, res: any, next: any) => next(),
    };
    const { buildValue } = await configureApp(
      app,
      getIo as any,
      fakeVite as any,
    );
    const res = await request(app).get("/api/musics").expect(200);
    expect(res.body).toBeDefined();
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.musics)).toBe(true);
    const ids = res.body.musics
      .map((m: unknown) => (m as Record<string, unknown>).id)
      .sort();
    expect(ids).toEqual(["m1", "m2"]);
  });
});
