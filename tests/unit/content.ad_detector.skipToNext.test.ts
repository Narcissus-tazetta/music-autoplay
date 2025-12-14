import { describe, expect, test } from 'bun:test';
import createFakeChrome from '../helpers/fakeChrome';

describe('AdDetector near-end ad skip', () => {
    test('ad near end triggers ad_skip_to_next message', async () => {
        const chrome = createFakeChrome();
        (global as any).chrome = chrome;
        const mod = await import('../../youtube-auto-play/src/content/content');
        const AdDetector = mod.AdDetector;

        const { JSDOM } = await import('jsdom');
        const dom = new JSDOM('<!doctype html><html><body></body></html>');
        (global as any).window = dom.window;
        (global as any).document = dom.window.document;
        (global as any).navigator = dom.window.navigator;
        (global as any).location = dom.window.location;

        const player = document.createElement('div');
        player.classList.add('html5-video-player');
        document.body.appendChild(player);

        const video = document.createElement('video') as HTMLVideoElement;
        Object.defineProperty(video, 'duration', { value: 60, writable: true });
        Object.defineProperty(video, 'currentTime', { value: 58, writable: true });
        player.appendChild(video);

        player.classList.add('ad-showing');

        const ad = new AdDetector();
        ad.setVideoElement(video);

        (ad as any).checkAndNotifyAdState();

        await new Promise(res => setTimeout(res, 0));

        expect(chrome.runtime.lastMessage).toBeDefined();
        expect((chrome.runtime.lastMessage as any).type).toBe('ad_skip_to_next');
    });
});
