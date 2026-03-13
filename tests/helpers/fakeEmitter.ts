export function createFakeEmitter() {
    const calls: Array<{ event: string; payload: any }> = [];
    return {
        emitHistoryAdded(payload: any) {
            calls.push({ event: 'historyAdded', payload });
            return { ok: true };
        },
        emitMusicRemoved(payload: any) {
            calls.push({ event: 'musicRemoved', payload });
            return { ok: true };
        },
        emitUrlList(payload: any) {
            calls.push({ event: 'urlList', payload });
            return { ok: true };
        },
        getCalls() {
            return calls.slice();
        },
    } as const;
}

export default createFakeEmitter;
