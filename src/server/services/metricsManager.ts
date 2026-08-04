import type { Metrics } from '../bootstrap';

export class MetricsManager {
    private metrics: Metrics;

    constructor() {
        this.metrics = {
            apiMusics: { calls: 0, errors: 0, totalMs: 0 },
            rpcGetAllMusics: { calls: 0, errors: 0, totalMs: 0 },
        };
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
}

/** Single process-wide instance; the DI container previously handed out this same object. */
export const metricsManager = new MetricsManager();
