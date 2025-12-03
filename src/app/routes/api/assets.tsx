import { safeExecuteAsync } from '@/shared/utils/errors';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import type { ActionFunctionArgs } from 'react-router';
import { YouTubeService } from '../../../server/services/youtubeService';

export const action = async ({ request }: ActionFunctionArgs) => {
    const toMsg = (x: unknown) => {
        if (typeof x === 'string') return x;
        if (
            x
            && typeof x === 'object'
            && 'message' in (x as Record<string, unknown>)
        ) {
            const m = (x as Record<string, unknown>).message;
            if (typeof m === 'string') return m;
        }
        try {
            return JSON.stringify(x);
        } catch {
            return Object.prototype.toString.call(x);
        }
    };

    const res = await safeExecuteAsync(async () => {
        const form = await request.formData();
        const videoIdRaw = form.get('videoId');
        const videoId = typeof videoIdRaw === 'string' ? videoIdRaw.trim() : '';
        if (videoId === '') {
            const e = new Error('videoId is required');
            (e as Error & { code?: string }).code = 'bad_request';
            throw e;
        }

        const yt = new YouTubeService();
        const r = await yt.getVideoDetails(videoId);
        if (!r.ok) {
            const msg = toMsg(r.error) || 'not found';
            const e = new Error(msg);
            (e as Error & { code?: string }).code = 'not_found';
            throw e;
        }

        const meta = r.value;
        let thumbnail = '';
        try {
            const raw = meta.raw;
            if (raw && typeof raw === 'object') {
                const snippet = (raw as Record<string, unknown>).snippet;
                if (snippet && typeof snippet === 'object') {
                    const thumbs = (snippet as Record<string, unknown>).thumbnails;
                    if (thumbs && typeof thumbs === 'object') {
                        const high = (thumbs as Record<string, unknown>)['high'];
                        const def = (thumbs as Record<string, unknown>)['default'];
                        if (
                            high
                            && typeof (high as Record<string, unknown>)['url'] === 'string'
                        ) {
                            thumbnail = (high as Record<string, unknown>)['url'] as string;
                        } else if (
                            def
                            && typeof (def as Record<string, unknown>)['url'] === 'string'
                        ) {
                            thumbnail = (def as Record<string, unknown>)['url'] as string;
                        }
                    }
                }
            }
        } catch {
            thumbnail = '';
        }

        return {
            title: meta.title,
            thumbnail,
            length: meta.duration,
            isMusic: !meta.isAgeRestricted,
            channelId: meta.channelId,
            channelName: meta.channelTitle,
            id: videoId,
        };
    });

    if (!res.ok) return respondWithResult(makeErr({ message: toMsg(res.error) }));

    return new Response(JSON.stringify(res.value), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};

export default function Route() {
    return null;
}
