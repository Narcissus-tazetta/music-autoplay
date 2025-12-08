import { replaceConsoleWithLogger } from '../../src/server/logger';
import { describe, expect, it } from '../bunTestCompat';

describe('console wrapper', () => {
    it('replaces and restores console methods', () => {
        const origLog = console.log;
        const origError = console.error;
        const restore = replaceConsoleWithLogger();
        try {
            expect(console.log).not.toBe(origLog);
            expect(console.error).not.toBe(origError);
        } finally {
            restore();
        }
        expect(console.log).toBe(origLog);
        expect(console.error).toBe(origError);
    });
});
