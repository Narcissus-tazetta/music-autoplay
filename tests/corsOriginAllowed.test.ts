import { type CorsConfig, isOriginAllowed } from '@/server/socket/core/cors';
import { describe, expect, test } from 'bun:test';

const cfg = (over: Partial<CorsConfig> = {}): CorsConfig => ({
    allowAllOrigins: false,
    allowExtensionOrigins: false,
    origins: [],
    ...over,
});

describe('isOriginAllowed', () => {
    test('allows any origin when allowAllOrigins is set', () => {
        expect(isOriginAllowed('https://evil.example', cfg({ allowAllOrigins: true }))).toBe(true);
    });

    test('allows an exactly listed origin', () => {
        const c = cfg({ origins: ['https://music.example', 'http://localhost:3000'] });
        expect(isOriginAllowed('https://music.example', c)).toBe(true);
        expect(isOriginAllowed('http://localhost:3000', c)).toBe(true);
    });

    test('rejects an origin that is not listed', () => {
        expect(isOriginAllowed('https://evil.example', cfg({ origins: ['https://music.example'] }))).toBe(false);
    });

    test('does not treat a listed origin as a prefix', () => {
        const c = cfg({ origins: ['https://music.example'] });
        expect(isOriginAllowed('https://music.example.evil.com', c)).toBe(false);
    });

    test('allows a specific extension origin listed in full, even with extension origins off', () => {
        const c = cfg({ origins: ['chrome-extension://abcdef'] });
        expect(isOriginAllowed('chrome-extension://abcdef', c)).toBe(true);
        expect(isOriginAllowed('chrome-extension://other', c)).toBe(false);
    });

    test('a scheme-only entry acts as a prefix rule when extension origins are enabled', () => {
        const c = cfg({ allowExtensionOrigins: true, origins: ['chrome-extension://'] });
        expect(isOriginAllowed('chrome-extension://anything', c)).toBe(true);
        expect(isOriginAllowed('moz-extension://anything', c)).toBe(false);
    });

    test('a scheme-only entry does nothing while extension origins are disabled', () => {
        const c = cfg({ allowExtensionOrigins: false, origins: ['chrome-extension://'] });
        expect(isOriginAllowed('chrome-extension://anything', c)).toBe(false);
    });

    test('production config shape: exact extension origin allowed, others rejected', () => {
        // Mirrors render.yaml: full origins listed, ALLOW_EXTENSION_ORIGINS=false.
        const c = cfg({
            origins: ['https://music-auto-play.onrender.com', 'chrome-extension://flhmplnalnjjbmmjdcdehcoeiihnloja'],
        });
        expect(isOriginAllowed('https://music-auto-play.onrender.com', c)).toBe(true);
        expect(isOriginAllowed('chrome-extension://flhmplnalnjjbmmjdcdehcoeiihnloja', c)).toBe(true);
        expect(isOriginAllowed('chrome-extension://someotherextension', c)).toBe(false);
        expect(isOriginAllowed('https://phishing.example', c)).toBe(false);
    });
});
