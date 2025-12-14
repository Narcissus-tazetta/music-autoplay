type Callback = (...args: any[]) => void;
export function createFakeSocket() {
    const events: Record<string, Callback[]> = {};
    const emitted: Array<{ event: string; data: any[] }> = [];
    return {
        on(event: string, cb: Callback) {
            (events[event] ??= []).push(cb);
        },
        once(event: string, cb: Callback) {
            (cb as any).__once = true;
            (events[event] ??= []).push(cb);
        },
        emit(event: string, ...data: any[]) {
            emitted.push({ event, data });
            const cbs = events[event] ?? [];
            for (const cb of cbs.slice()) {
                cb(...data);
                if ((cb as any).__once) {
                    const idx = cbs.indexOf(cb);
                    if (idx !== -1) cbs.splice(idx, 1);
                }
            }
        },
        getEmitted() {
            return emitted.slice();
        },
        trigger(event: string, ...data: any[]) {
            const cbs = events[event] ?? [];
            for (const cb of cbs) cb(...data);
        },
        connected: true as boolean,
        connect() {
            (this as any).connected = true;
        },
        disconnect() {
            (this as any).connected = false;
        },
    } as const;
}

export default createFakeSocket;
