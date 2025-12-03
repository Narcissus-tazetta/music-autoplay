const ALLOWED_YOUTUBE_DOMAINS = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
];

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function isValidYoutubeDomain(hostname: string): boolean {
    return ALLOWED_YOUTUBE_DOMAINS.some(
        domain => hostname === domain || hostname.endsWith(`.${domain}`),
    );
}

function sanitizeVideoId(id: string): string | null {
    if (!id || typeof id !== 'string') return;
    const cleaned = id.trim().replace(/[^\w-]/g, '');
    return YOUTUBE_VIDEO_ID_PATTERN.test(cleaned) ? cleaned : undefined;
}

export function extractYoutubeId(url: string): string | null {
    if (!url || typeof url !== 'string' || url.length > 2048) return;

    try {
        const u = new URL(url);

        if (!isValidYoutubeDomain(u.hostname)) return;

        if (u.protocol !== 'https:' && u.protocol !== 'http:') return;

        if (u.hostname.includes('youtube.com')) {
            const v = u.searchParams.get('v');
            if (v) return sanitizeVideoId(v);
        }

        if (u.hostname === 'youtu.be' || u.hostname.endsWith('.youtu.be')) {
            const p = u.pathname.replace(/^\//, '');
            const videoId = p.split('/')[0];
            return sanitizeVideoId(videoId);
        }

        const YOUTUBE_PATTERN =
            /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i;
        const m = url.match(YOUTUBE_PATTERN);
        return m ? sanitizeVideoId(m[1]) : undefined;
    } catch {
        return;
    }
}

export const YOUTUBE_PATTERN =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i;

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const channelUrl = (channelId: string) => `https://www.youtube.com/channel/${channelId}`;
export const shortUrl = (id: string) => `https://youtu.be/${id}`;
export const searchUrl = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
