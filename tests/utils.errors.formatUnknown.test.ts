import { extractErrorInfo, formatUnknown, toHandlerError } from '../src/shared/utils/errors/core';
import { describe, expect, it } from './bunTestCompat';

/**
 * core.ts used to reach for `util.inspect` here. It is imported by client code, where Vite
 * replaces `node:util` with an empty object, so `util.inspect` was `undefined` and the error
 * formatter threw a TypeError - in the browser, on the error path. Every case below took that
 * branch and would have crashed.
 */
describe('formatUnknown', () => {
    it('renders the nullish values util.inspect used to handle', () => {
        expect(formatUnknown(null)).toBe('null');
        expect(formatUnknown(undefined)).toBe('undefined');
    });

    it('renders primitives', () => {
        expect(formatUnknown(42)).toBe('42');
        expect(formatUnknown(0)).toBe('0');
        expect(formatUnknown(Number.NaN)).toBe('NaN');
        expect(formatUnknown(true)).toBe('true');
        expect(formatUnknown('already a string')).toBe('already a string');
        expect(formatUnknown(10n)).toBe('10n');
        expect(formatUnknown(Symbol('boom'))).toBe('Symbol(boom)');
    });

    it('names functions', () => {
        expect(formatUnknown(function namedFn() {})).toBe('[Function: namedFn]');
        expect(formatUnknown(() => {})).toContain('[Function:');
    });

    it('serialises plain objects and arrays', () => {
        expect(formatUnknown({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}');
        expect(formatUnknown([1, 2, 3])).toBe('[1,2,3]');
    });

    it('survives a circular reference', () => {
        const circular: Record<string, unknown> = { name: 'root' };
        circular.self = circular;

        const out = formatUnknown(circular);

        expect(out).toContain('"name":"root"');
        expect(out).toContain('[Circular]');
    });

    it('survives a BigInt inside an object, which plain JSON.stringify rejects', () => {
        expect(() => JSON.stringify({ big: 1n })).toThrow();

        expect(formatUnknown({ big: 1n })).toBe('{"big":"1n"}');
    });

    it('survives a getter that throws', () => {
        const hostile = {
            get boom(): never {
                throw new Error('nope');
            },
        };

        expect(() => formatUnknown(hostile)).not.toThrow();
        expect(formatUnknown(hostile)).toBe('[object Object]');
    });

    it('caps runaway output', () => {
        const huge = { blob: 'x'.repeat(50_000) };

        const out = formatUnknown(huge);

        expect(out.length).toBeLessThanOrEqual(2_001);
        expect(out.endsWith('…')).toBe(true);
    });
});

describe('extractErrorInfo on values that used to hit util.inspect', () => {
    it('handles primitives without throwing', () => {
        expect(extractErrorInfo(42).message).toBe('42');
        expect(extractErrorInfo(null).message).toBe('null');
        expect(extractErrorInfo(undefined).message).toBe('undefined');
        expect(extractErrorInfo(true).message).toBe('true');
    });

    it('handles a circular object whose JSON.stringify throws', () => {
        const circular: Record<string, unknown> = { code: 'E_LOOP' };
        circular.self = circular;

        const info = extractErrorInfo(circular);

        expect(info.code).toBe('E_LOOP');
        expect(info.message).toContain('[Circular]');
    });

    it('toHandlerError does not throw on a primitive', () => {
        expect(() => toHandlerError(undefined)).not.toThrow();
        expect(toHandlerError(7).message).toBe('7');
    });

    // Unchanged paths, kept so the refactor cannot quietly alter them.
    it('still prefers Error.message and the message field of records', () => {
        expect(extractErrorInfo(new Error('boom')).message).toBe('boom');
        expect(extractErrorInfo('plain string').message).toBe('plain string');
        expect(extractErrorInfo({ message: 'from record' }).message).toBe('from record');
    });
});
