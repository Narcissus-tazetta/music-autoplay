import { YouTubeService } from '@/server/services/youtubeService';
import { describe, expect, test } from 'bun:test';

describe('YouTubeService diagnostics', () => {
    test('returns queue and cache diagnostics', () => {
        const service = new YouTubeService();
        const diagnostics = service.getDiagnostics();

        expect(diagnostics.cacheSize).toBeGreaterThanOrEqual(0);
        expect(diagnostics.maxEntries).toBeGreaterThan(0);
        expect(diagnostics.defaultTtlMs).toBeGreaterThan(0);
        expect(diagnostics.requestQueueLength).toBe(0);
        expect(diagnostics.requestQueueMax).toBeGreaterThan(0);
        expect(typeof diagnostics.isProcessingQueue).toBe('boolean');

        service.destroy();
    });
});
