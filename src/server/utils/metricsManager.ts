import type { Metrics } from "../bootstrap";
import logger from "../logger";

class MetricsManager {
  private metrics: Metrics;

  constructor() {
    this.metrics = {
      apiMusics: { calls: 0, errors: 0, totalMs: 0 },
      rpcGetAllMusics: { calls: 0, errors: 0, totalMs: 0 },
    };
    globalThis.__simpleMetrics = this.metrics;
  }

  updateApiMusics(duration: number, hasError: boolean = false): void {
    this.metrics.apiMusics.calls++;
    this.metrics.apiMusics.totalMs += duration;
    if (hasError) this.metrics.apiMusics.errors++;
  }

  updateRpcGetAllMusics(duration: number, hasError: boolean = false): void {
    this.metrics.rpcGetAllMusics.calls++;
    this.metrics.rpcGetAllMusics.totalMs += duration;
    if (hasError) this.metrics.rpcGetAllMusics.errors++;
  }

  getMetrics(): Readonly<Metrics> {
    return { ...this.metrics };
  }

  logMetrics(): void {
    logger.info("Current metrics", { metrics: this.getMetrics() });
  }

  resetMetrics(): void {
    this.metrics.apiMusics = { calls: 0, errors: 0, totalMs: 0 };
    this.metrics.rpcGetAllMusics = { calls: 0, errors: 0, totalMs: 0 };
  }
}

export default MetricsManager;
