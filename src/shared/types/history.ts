export type HistorySort = 'newest' | 'oldest' | 'mostPlayed';

export interface HistoryItem {
    id: string;
    title: string;
    channelName: string;
    channelId: string;
    duration: string;
    playCount: number;
    firstPlayedAt: string;
    lastPlayedAt: string;
}

export interface HistoryQuery {
    query?: string;
    from?: string;
    to?: string;
    sort?: HistorySort;
}
