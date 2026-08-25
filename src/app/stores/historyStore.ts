import type { HistoryItem, HistoryQuery, HistorySort } from '@/shared/types/history';
import type { C2S, S2C } from '@/shared/types/socket';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { getSocket } from '../utils/socketClient';

interface HistoryStore {
    items: HistoryItem[];
    query: string;
    from: string;
    to: string;
    sort: HistorySort;
    socket?: Socket<S2C, C2S> | null;
    setQuery: (query: string) => void;
    setFrom: (from: string) => void;
    setTo: (to: string) => void;
    setSort: (sort: HistorySort) => void;
    connectSocket: () => void;
    fetchHistory: (query?: Partial<HistoryQuery>) => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => {
    let socket: Socket<S2C, C2S> | null = null;

    const request = (overrides?: Partial<HistoryQuery>) => {
        if (!socket) return;
        const state = get();
        const resolvedFrom = overrides?.from ?? state.from;
        const resolvedTo = overrides?.to ?? state.to;
        const payload: HistoryQuery = {
            from: resolvedFrom.length > 0 ? resolvedFrom : undefined,
            sort: overrides?.sort ?? state.sort,
            to: resolvedTo.length > 0 ? resolvedTo : undefined,
        };
        socket.emit('getHistory', payload, (items: HistoryItem[] | undefined) => {
            if (Array.isArray(items)) set({ items });
        });
    };

    return {
        connectSocket() {
            if (socket) return;
            socket = getSocket();

            socket
                .on('connect', () => {
                    request();
                })
                .on('historyAdded', () => {
                    request();
                });

            if (socket.connected) request();

            set({ socket });
        },
        fetchHistory(overrides?: Partial<HistoryQuery>) {
            request(overrides);
        },
        from: '',
        items: [],
        query: '',
        setFrom(from) {
            set({ from });
        },
        setQuery(query) {
            set({ query });
        },
        setSort(sort) {
            set({ sort });
        },
        setTo(to) {
            set({ to });
        },
        socket: undefined,
        sort: 'newest',
        to: '',
    };
});
