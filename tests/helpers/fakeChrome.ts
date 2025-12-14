export function createFakeChrome() {
    const tabs = {
        updated: [] as Array<{ tabId: number; props: any }>,
        created: [] as Array<{ props: any }>,
        onRemoved: {
            _cb: null as any,
            addListener(cb: any) {
                tabs.onRemoved._cb = cb;
            },
            removeListener(cb: any) {
                if (tabs.onRemoved._cb === cb) tabs.onRemoved._cb = null;
            },
        },
        update(tabId: number, props: any, cb?: () => void) {
            tabs.updated.push({ tabId, props });
            cb?.();
        },
        create(props: any, cb?: (tab: any) => void) {
            tabs.created.push({ props });
            cb?.({ id: 999, ...props });
        },
        sendMessage(tabId: number, message: any, cb?: (response?: any) => void) {
            // Simulate a successful message send
            cb?.({ status: 'ok' });
        },
        query(queryObj: any, cb: (tabs: any[]) => void) {
            // return a single matching tab with id 1
            cb([{ id: 1, url: queryObj.url || 'https://www.youtube.com/watch?v=abc', discarded: false }]);
        },
        remove(ids: number[] | number, cb?: () => void) {
            cb?.();
        },
    };
    const runtime: any = {
        lastMessage: null as any,
        sendMessage(msg: any) {
            runtime.lastMessage = msg;
        },
        onMessage: {
            _cb: null as any,
            addListener(cb: any) {
                runtime.onMessage._cb = cb;
            },
            removeListener(cb: any) {
                if (runtime.onMessage._cb === cb) runtime.onMessage._cb = null;
            },
        },
        trigger(msg: any, sender?: any) {
            runtime.onMessage._cb?.(msg, sender, () => {});
        },
    };
    const storage = {
        data: {} as Record<string, any>,
        local: {
            get(keys: any, cb: (items: any) => void) {
                cb(storage.data);
            },
            set(items: any, cb?: () => void) {
                Object.assign(storage.data, items);
                cb?.();
            },
        },
    };
    // convenience: allow direct access to local.data
    (storage.local as any).data = storage.data;
    (global as any).chrome = { tabs, runtime, storage } as any;
    return { tabs, runtime, storage };
}

export default createFakeChrome;
