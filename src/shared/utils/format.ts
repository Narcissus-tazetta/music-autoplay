export const formatDuration = (duration: string): string => {
    if (/^\d{2}:\d{2}:\d{2}$/.test(duration)) {
        const parts = duration.split(':');
        const hours = Number.parseInt(parts[0], 10);
        const minutes = Number.parseInt(parts[1], 10);
        const seconds = Number.parseInt(parts[2], 10);

        if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    const isoMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (isoMatch) {
        const hours = isoMatch[1] ? Number.parseInt(isoMatch[1], 10) : 0;
        const minutes = isoMatch[2] ? Number.parseInt(isoMatch[2], 10) : 0;
        const seconds = isoMatch[3] ? Number.parseInt(isoMatch[3], 10) : 0;

        if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    return duration;
};

export const formatSecondsToTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatRequestedAt = (isoString?: string): string => {
    if (!isoString) return 'unknown';

    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60_000);
        const diffHours = Math.floor(diffMs / 3_600_000);
        const diffDays = Math.floor(diffMs / 86_400_000);

        if (diffMins < 1) return 'たった今';
        if (diffMins < 60) return `${diffMins}分前`;
        if (diffHours < 24) return `${diffHours}時間前`;
        if (diffDays < 7) return `${diffDays}日前`;

        return date.toLocaleDateString('ja-JP', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return 'unknown';
    }
};
