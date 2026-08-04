import { create } from 'zustand';
import { useHistoryStore } from './historyStore';

type HomeViewMode = 'requests' | 'history';

interface HomeViewStore {
    viewMode: HomeViewMode;
    setViewMode: (mode: HomeViewMode) => void;
    resetToRequests: () => void;
}

function clearHistorySearch() {
    useHistoryStore.getState().setQuery('');
}

export const useHomeViewStore = create<HomeViewStore>(set => ({
    resetToRequests: () => {
        clearHistorySearch();
        set({ viewMode: 'requests' });
    },
    setViewMode: viewMode => {
        if (viewMode === 'requests') clearHistorySearch();
        set({ viewMode });
    },
    viewMode: 'requests',
}));
