import { describe, expect, test } from 'bun:test';
import createFakeChrome from '../helpers/fakeChrome';

describe('AdDetector progressBuffer upper bound', () => {
    test('progressBuffer drops oldest entries when exceeding max', async () => {
        const chrome = createFakeChrome();
        (global as any).chrome = chrome;
        const { JSDOM } = await import('jsdom');
        const dom = new JSDOM('<!doctype html><html><body></body></html>');
        (global as any).window = dom.window;
        (global as any).document = dom.window.document;
        (global as any).navigator = dom.window.navigator;
        (global as any).location = dom.window.location;
        // ensure global history is available for top-level content script initialization
        (global as any).history = dom.window.history;

        const mod = await import('../../youtube-auto-play/src/content/content');
        const AdDetector = mod.AdDetector;

        const ad = new AdDetector();

        // push PROGRESS_BUFFER_MAX + 1 updates
        const limit = 500;
        for (let i = 0; i < limit + 1; i++) {
            (ad as any).addToProgressBuffer({
                type: 'progress_update',
                url: 'u',
                currentTime: i,
                duration: 100,
                timestamp: i,
            });
        }

        const buf = (ad as any).progressBuffer as any[];
        expect(buf.length).toBe(limit);
        // earliest remaining entry should be with timestamp 1 (since 0 should be dropped)
        expect(buf[0].timestamp).toBe(1);
    });
});
