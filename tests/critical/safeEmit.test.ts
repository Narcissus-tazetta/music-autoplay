import type { Server as IOServer } from 'socket.io';
import { createSocketEmitter } from '../../src/server/utils/safeEmit';
import { describe, expect, it } from '../bunTestCompat';

const ioStub = (emit: (event: string, payload: unknown) => void) => (() => ({ emit }) as unknown as IOServer);

describe('createSocketEmitter', () => {
    it('emits the event and payload, and only those', () => {
        const calls: unknown[][] = [];
        const emitter = createSocketEmitter(ioStub((...args) => calls.push(args)), { source: 'test' });

        expect(emitter.emit('evt', { p: 1 })).toBe(true);
        expect(calls).toEqual([['evt', { p: 1 }]]);
    });

    it('returns false when the emitter is unusable', () => {
        const emitter = createSocketEmitter(() => ({} as unknown as IOServer));
        expect(emitter.emit('evt', {}, { silent: true })).toBe(false);
    });

    it('returns false when emit throws', () => {
        const emitter = createSocketEmitter(ioStub(() => {
            throw new Error('boom');
        }));
        expect(emitter.emit('evt', {}, { silent: true })).toBe(false);
    });

    it('asFn adapts to a bare (event, payload) function', () => {
        const calls: unknown[][] = [];
        const fn = createSocketEmitter(ioStub((...args) => calls.push(args))).asFn();

        fn('evt', { p: 2 });
        expect(calls).toEqual([['evt', { p: 2 }]]);
    });
});
