import { describe, expect, test } from 'bun:test';
import createFakeChrome from '../helpers/fakeChrome';

describe('AdDetector stop behavior', () => {
    test('stop deletes seq for lastVideoId and requests socket disconnect', async () => {
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
        // simulate lastVideoId and seq map
        (ad as any).lastVideoId = 'vid123';
        (ad as any).seqByVideoId.set('vid123', 42);

        ad.stop();

        expect((ad as any).seqByVideoId.has('vid123')).toBe(false);
        expect(chrome.runtime.lastMessage).toBeDefined();
        expect((chrome.runtime.lastMessage as any).type).toBe('disconnect_socket');
    });
});
