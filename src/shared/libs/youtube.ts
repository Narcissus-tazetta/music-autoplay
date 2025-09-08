export function extractYoutubeId(url: string): string | null {
    try {
        const u = new URL(url);

        // https://www.youtube.com/watch?v=VIDEOID
        if (u.hostname.includes("youtube.com")) {
            const v = u.searchParams.get("v");
            if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
        }

        // https://youtu.be/VIDEOID
        if (u.hostname === "youtu.be" || u.hostname.endsWith(".youtu.be")) {
            const p = u.pathname.replace(/^\//, "");
            if (/^[A-Za-z0-9_-]{11}$/.test(p)) return p;
            const first = p.split("/")[0];
            if (/^[A-Za-z0-9_-]{11}$/.test(first)) return first;
        }

        const YOUTUBE_PATTERN =
            /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i;
        const m = url.match(YOUTUBE_PATTERN);
        return m ? m[1] : null;
    } catch {
        const YOUTUBE_PATTERN =
            /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i;
        const m = url.match(YOUTUBE_PATTERN);
        return m ? m[1] : null;
    }
}

export const YOUTUBE_PATTERN =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i;
