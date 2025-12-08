import { createSafeEmitter, safeEmit, safeEmitSync, wrapEmitWithSafety } from '../../src/server/utils/safeEmit';
import { describe, expect, it } from '../bunTestCompat';

describe('safeEmit utilities', () => {
    it('returns false for invalid emitter', () => {
        const bad = {} as any;
        const ok = safeEmit(bad, 'testEvent' as any, { silent: true } as any);
        expect(ok).toBe(false);
    });

    it('calls emit on a valid emitter', () => {
        const calls: { ev: string; payload?: unknown }[] = [];
        const emitter = {
            emit: (ev: string, payload?: unknown) => calls.push({ ev, payload }),
        } as any;
        const ok = safeEmit(emitter, 'e' as any, { a: 1 } as any);
        expect(ok).toBe(true);
        expect(calls.length).toBe(1);
        expect(calls[0].ev).toBe('e');
    });

    it('safeEmitSync calls emit and returns true/false appropriately', () => {
        const calls: any[] = [];
        const emitter = {
            emit: (ev: string, payload?: unknown) => calls.push({ ev, payload }),
        } as any;
        expect(safeEmitSync(emitter, 'mRemoved' as any, 'id1')).toBe(true);
        expect(calls.length).toBe(1);
        // throwing emitter
        const bad = {
            emit: () => {
                throw new Error('boom');
            },
        } as any;
        expect(safeEmitSync(bad, 'x' as any)).toBe(false);
    });

    it('createSafeEmitter merges default and user context and forwards options', () => {
        const received: any[] = [];
        const emitter = {
            emit: (ev: string, payload: unknown, opts: any) => received.push({ ev, opts, payload }),
        } as any;
        const se = createSafeEmitter(emitter, {
            identifiers: { id: 'x' },
            operation: 'op',
        });
        const ok = se(
            'evt' as any,
            { p: 1 } as any,
            { context: { identifiers: { id2: 'y' } } } as any,
        );
        expect(ok).toBe(true);
        expect(received.length).toBe(1);
        expect(received[0].ev).toBe('evt');
        expect(received[0].opts.context.identifiers.id).toBe('x');
        expect(received[0].opts.context.identifiers.id2).toBe('y');
    });

    it('wrapEmitWithSafety returns false when inner emit throws and true otherwise', () => {
        const badEmit = (_: string, __: unknown) => {
            throw new Error('fail');
        };
        const wrapped = wrapEmitWithSafety(badEmit as any, {});
        const ok1 = wrapped('e', { p: 1 });
        expect(ok1).toBe(false);

        const goodEmit = (_: string, __: unknown) => {};
        const wrapped2 = wrapEmitWithSafety(goodEmit, {});
        const ok2 = wrapped2('e', { p: 2 });
        expect(ok2).toBe(true);
    });
});
