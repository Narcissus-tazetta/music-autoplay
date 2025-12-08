import { normalizeYoutubeMeta } from '../../src/server/utils/normalizeYoutubeMeta';
import { describe, expect, it } from '../bunTestCompat';

describe('normalizeYoutubeMeta', () => {
    it('keeps PT duration when no raw content is present', () => {
        const meta = {
            channelId: 'cid',
            channelTitle: 'C',
            duration: 'PT1M30S',
            isAgeRestricted: false,
            title: 'T',
        } as const;
        const out = normalizeYoutubeMeta('id1', meta as unknown);
        expect(out).not.toBeNull();
        expect(out?.duration).toBe('PT1M30S');
        expect(out?.isAgeRestricted).toBe(false);
    });

    it('converts PT to HH:MM:SS when raw contentDetails exists', () => {
        const meta = {
            channelId: 'cid',
            channelTitle: 'C',
            duration: 'PT1M30S',
            raw: { contentDetails: { duration: 'PT1M30S' } },
            title: 'T',
        } as unknown;
        const out = normalizeYoutubeMeta('id2', meta);
        expect(out).not.toBeNull();
        expect(out?.duration).toBe('00:01:30');
    });

    it('converts numeric seconds to HH:MM:SS', () => {
        const meta = {
            channelId: 'cid',
            channelTitle: 'C',
            duration: 90,
            title: 'T',
        } as unknown;
        const out = normalizeYoutubeMeta('id3', meta);
        expect(out).not.toBeNull();
        expect(out?.duration).toBe('00:01:30');
    });

    it('detects age restricted via raw.contentDetails.contentRating', () => {
        const meta = {
            channelId: 'cid',
            channelTitle: 'C',
            duration: 'PT0S',
            raw: {
                contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } },
            },
            title: 'T',
        } as unknown;
        const out = normalizeYoutubeMeta('id4', meta);
        expect(out).not.toBeNull();
        expect(out?.isAgeRestricted).toBe(true);
    });

    it('returns null when required fields missing', () => {
        const meta = { channelTitle: 'C', duration: 'PT1M' } as unknown;
        const out = normalizeYoutubeMeta('id5', meta);
        expect(out).toBeNull();
    });
});
