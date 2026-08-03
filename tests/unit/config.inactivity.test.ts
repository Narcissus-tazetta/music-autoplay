import { describe, expect, test } from 'bun:test';
import { socketConfig } from '../../src/server/config';

describe('socketConfig inactivity defaults', () => {
    test('should have 5 minutes default for playing inactivity', () => {
        expect(socketConfig.remoteStatusInactivityMsPlaying).toBe(1000 * 60 * 5);
    });

    test('should have 30 minutes default for paused inactivity', () => {
        expect(socketConfig.remoteStatusInactivityMsPaused).toBe(1000 * 60 * 30);
    });
});
