import { describe, expect, test } from 'bun:test';
import { getConfigService } from '../../src/server/config/configService';

describe('ConfigService inactivity defaults', () => {
    test('should have 5 minutes default for playing inactivity', () => {
        const cfg = getConfigService().getSocketConfig();
        const playing = cfg.remoteStatusInactivityMsPlaying;
        expect(playing).toBeDefined();
        expect(playing).toBe(1000 * 60 * 5);
    });

    test('should have 30 minutes default for paused inactivity', () => {
        const cfg = getConfigService().getSocketConfig();
        const paused = cfg.remoteStatusInactivityMsPaused;
        expect(paused).toBeDefined();
        expect(paused).toBe(1000 * 60 * 30);
    });
});
