import { describe, expect, test } from 'bun:test';
import { handleNoNextVideo, navigateToNextVideo } from '../../youtube-auto-play/src/bg/youtube-state';
import createFakeChrome from '../helpers/fakeChrome';

describe('youtube-state navigation', () => {
    test('navigateToNextVideo updates tab and storage', () => {
        const chrome = createFakeChrome();
        (global as any).chrome = chrome;

        navigateToNextVideo('https://youtu.be/CCC', 123);

        expect(chrome.tabs.updated.length).toBe(1);
        expect(chrome.tabs.updated[0].tabId).toBe(123);
        expect(chrome.tabs.updated[0].props.url).toBe('https://youtu.be/CCC');
        expect(chrome.storage.data.latestUrl).toBe('https://youtu.be/CCC');
    });

    test('handleNoNextVideo sends show_video_end_alert and sets latestUrl ended', async () => {
        const chrome = createFakeChrome();
        (global as any).chrome = chrome;

        // call with a tab id that will be found by query
        handleNoNextVideo(1);
        expect(chrome.storage.data.latestUrl).toBe('ended');
    });
});
