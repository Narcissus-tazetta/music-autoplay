import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Notifications } from '../src/app/components/Notifications';
import { notify } from '../src/app/utils/notifications';

test('notifications show API feedback and can be dismissed', async () => {
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
    const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
    const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperties(globalThis, {
        window: { configurable: true, writable: true, value: dom.window },
        document: { configurable: true, writable: true, value: dom.window.document },
        IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
    });
    const container = document.getElementById('root')!;
    const root = createRoot(container);
    try {
        await act(async () => {
            root.render(<Notifications />);
        });
        await act(async () => {
            notify({ level: 'error', message: '送信に失敗しました' });
        });
        expect(container.querySelector('[role="alert"]')?.textContent).toContain('送信に失敗しました');
        await act(async () => {
            container.querySelector('button')!.click();
        });
        expect(container.querySelector('[role="alert"]')).toBeNull();
    } finally {
        await act(async () => {
            root.unmount();
        });
        keys.forEach((key, index) => {
            const descriptor = previous[index];
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
        dom.window.close();
    }
});
