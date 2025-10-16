import express from "express";
import request from "supertest";
import configureApp from "../../src/server/configureApp";
import { describe, expect, it } from "../bunTestCompat";

describe("/api/socket-info endpoint", () => {
  it("returns socket diagnostics for socket middleware", async () => {
    const app = express();
    const fakeVite = {
      ssrLoadModule: async (_: string) => ({}),
      middlewares: (req: any, res: any, next: any) => next(),
    };
    const getIo = () => null;
    await configureApp(app, getIo as any, fakeVite as any);
    const res = await request(app).get("/diagnostics/socket");
    if (res.status !== 200)
      console.error("/api/socket-info status", res.status, "body:", res.text);
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.ok).toBe(true);
    expect(res.body.socketPath).toBeDefined();
    expect(typeof res.body.socketPath).toBe("string");
  });
});
