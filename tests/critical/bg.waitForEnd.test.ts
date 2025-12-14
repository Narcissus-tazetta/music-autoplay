import { describe, expect, test } from 'bun:test';
import { waitForVideoEnd } from '../../youtube-auto-play/src/bg/socket-events';
import createFakeChrome from '../helpers/fakeChrome';

describe('waitForVideoEnd behavior', () => {
    test('on video_ended message from playing tab, opens new tab', () => {
        const chrome = createFakeChrome();
        (global as any).chrome = chrome;

        const playingTab = { id: 1, url: 'https://www.youtube.com/watch?v=abc' };
        waitForVideoEnd(playingTab as any, 'https://youtu.be/next');

        // simulate runtime message from the playing tab
        chrome.runtime.trigger({ type: 'video_ended' }, { tab: playingTab });

        // expect a new tab created
        expect(chrome.tabs.created.length).toBeGreaterThanOrEqual(1);
        expect(chrome.storage.data.latestUrl).toBe('https://youtu.be/next');
    });
});
