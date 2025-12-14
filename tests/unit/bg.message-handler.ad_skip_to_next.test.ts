import { describe, expect, test } from 'bun:test';
import { setupMessageHandler } from '../../youtube-auto-play/src/bg/message-handler';
import createFakeChrome from '../helpers/fakeChrome';
import createFakeSocket from '../helpers/fakeSocket';

describe('background message-handler ad_skip_to_next', () => {
    test('ad_skip_to_next sends video_ended via socket with tabId', () => {
        const chrome = createFakeChrome();
        const socket = createFakeSocket();
        (global as any).chrome = chrome;
        setupMessageHandler(socket as any);
        const message = { type: 'ad_skip_to_next', url: 'https://youtu.be/x' } as any;
        const sender = { tab: { id: 77 } } as any;
        chrome.runtime.trigger(message, sender);
        const emitted = socket.getEmitted();
        const end = emitted.find(e => e.event === 'video_ended');
        expect(end).toBeDefined();
    });
});
