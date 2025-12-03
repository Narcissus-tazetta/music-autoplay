import { safeLog } from '@/server/logger';
import type { YouTubeMeta } from '@/shared/schemas/music';

function parseISO8601ToSeconds(iso: string): number {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(iso);
    if (!m) throw new Error('invalid ISO8601 duration');
    const hours = m[1] ? Number(m[1]) : 0;
    const mins = m[2] ? Number(m[2]) : 0;
    const secs = m[3] ? Number(m[3]) : 0;
    return hours * 3600 + mins * 60 + secs;
}

function secondsToHMS(sec: number): string {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    return `${`${hours}`.padStart(2, '0')}:${`${mins}`.padStart(2, '0')}:${`${secs}`.padStart(2, '0')}`;
}

export function normalizeYoutubeMeta(
    id: string,
    meta: unknown,
): YouTubeMeta | null {
    if (!meta || typeof meta !== 'object') return null;
    const m = meta as Record<string, unknown>;

    let title: string | undefined = typeof m.title === 'string' ? m.title : undefined;
    let channelTitle: string | undefined = typeof m.channelTitle === 'string' ? m.channelTitle : undefined;
    let channelId: string | undefined = typeof m.channelId === 'string' ? m.channelId : undefined;
    let durationRaw: string | number | undefined = typeof m.duration === 'string' ? m.duration : undefined;
    if (typeof m.duration === 'number') durationRaw = m.duration;
    let isAgeRestricted: boolean | undefined = typeof m.isAgeRestricted === 'boolean' ? m.isAgeRestricted : undefined;

    if (
        (!title
            || !channelTitle
            || !channelId
            || durationRaw === undefined
            || isAgeRestricted === undefined)
        && m.raw
        && typeof m.raw === 'object'
    ) {
        const raw = m.raw as Record<string, unknown>;
        const snippet = raw.snippet as Record<string, unknown> | undefined;
        const contentDetails = raw.contentDetails as
            | Record<string, unknown>
            | undefined;

        if (!title && snippet) {
            if (typeof snippet.title === 'string') title = snippet.title;
            else if (
                snippet.localized
                && typeof snippet.localized === 'object'
                && typeof (snippet.localized as Record<string, unknown>).title === 'string'
            ) {
                title = (snippet.localized as Record<string, unknown>).title as string;
            } else if (
                snippet.defaultAudioLanguage
                && typeof snippet.defaultAudioLanguage === 'string'
            ) {
                title = snippet.defaultAudioLanguage;
            }
        }

        if (!channelTitle && snippet && typeof snippet.channelTitle === 'string') channelTitle = snippet.channelTitle;
        if (!channelId && snippet && typeof snippet.channelId === 'string') channelId = snippet.channelId;

        if (contentDetails && typeof contentDetails.duration === 'string') durationRaw = contentDetails.duration;

        if (contentDetails && contentDetails.contentRating) {
            const cr = contentDetails.contentRating as
                | Record<string, unknown>
                | boolean
                | undefined;
            if (typeof cr === 'object') {
                if (
                    cr['ytRating'] === 'ytAgeRestricted'
                    || cr['yt_rating'] === 'ytAgeRestricted'
                ) {
                    isAgeRestricted = true;
                }
                if (cr['ageRestricted'] === true) isAgeRestricted = true;
            } else if (typeof cr === 'boolean') {
                isAgeRestricted = cr;
            }
        }
    }

    if (!title || !channelTitle || !channelId) return null;
    let finalDuration: string | undefined = undefined;
    let durationFromRaw = false;
    if (typeof m.duration === 'string') durationFromRaw = false;
    if (typeof durationRaw === 'string' && m.raw && typeof m.raw === 'object') {
        const rawObj = m.raw as Record<string, unknown>;
        if (rawObj.contentDetails && typeof rawObj.contentDetails === 'object') durationFromRaw = true;
    }

    if (typeof durationRaw === 'string') {
        const s = durationRaw;
        if (s.startsWith('PT')) {
            if (!durationFromRaw) finalDuration = s;
            else {
                try {
                    const secs = parseISO8601ToSeconds(s);
                    finalDuration = secondsToHMS(secs);
                } catch (err: unknown) {
                    safeLog(
                        'debug',
                        'normalizeYoutubeMeta: failed to parse ISO8601 duration',
                        {
                            error: err,
                            value: s,
                        },
                    );
                    finalDuration = s;
                }
            }
        } else if (/^\d+$/.test(s)) finalDuration = secondsToHMS(Number(s));
        else if (/^\d+:\d{2}:\d{2}$/.test(s) || /^\d{1,2}:\d{2}$/.test(s)) {
            const parts = s.split(':').map(p => Number(p));
            let secs = 0;
            if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
            else if (parts.length === 2) secs = parts[0] * 60 + parts[1];
            finalDuration = secondsToHMS(secs);
        } else {
            finalDuration = s;
        }
    } else if (typeof durationRaw === 'number') {
        finalDuration = secondsToHMS(durationRaw);
    }

    return {
        id,
        title,
        channelId,
        channelTitle,
        duration: finalDuration,
        isAgeRestricted: isAgeRestricted ?? false,
    } as YouTubeMeta;
}
