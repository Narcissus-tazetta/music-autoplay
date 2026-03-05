import { SERVER_ENV } from '@/app/env.server';
import { describe, expect, test } from 'bun:test';

describe('diagnostics env defaults', () => {
    test('uses default values without explicit env settings', () => {
        expect(SERVER_ENV.DIAG_MEM_ENABLED).toBe(true);
        expect(SERVER_ENV.DIAG_MEM_LOG_INTERVAL_MS).toBe(30_000);
        expect(SERVER_ENV.DIAG_MEM_REQUIRE_ADMIN_SECRET).toBe(false);
    });
});
