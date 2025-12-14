export function createFakeEmitter() {
    const calls: Array<{ event: string; payload: any }> = [];
    return {
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
