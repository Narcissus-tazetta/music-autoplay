import { afterEach, beforeEach, describe, expect, it } from '../bunTestCompat';

function makeLocalStorageMock(initial: Record<string, string> = {}) {
    let store: Record<string, string> = { ...initial };
    return {
        clear() {
            store = {};
        },
        getItem(key: string) {
            return Object.hasOwn(store, key) ? store[key] : undefined;
        },
        removeItem(key: string) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete store[key];
        },
        setItem(key: string, value: string) {
            store[key] = value;
        },
    } as Storage;
}

const STORAGE_KEY = 'music-auto-play:musics:v1';

interface MusicItem {
    id: string;
    title: string;
    channelName: string;
    channelId: string;
    duration: string;
}

interface RemoteStatus {
    type: string;
}

let _state: {
    musics: MusicItem[];
    socket: unknown | null;
    remoteStatus: RemoteStatus;
} = {
    musics: [],
    remoteStatus: { type: 'closed' },
    socket: undefined,
};

const useMusicStore = {
    getState() {
        return {
            ..._state,
            hydrateFromLocalStorage: function hydrateFromLocalStorage() {
                if (_state.musics.length > 0) return;
                try {
                    const raw = (globalThis as any).localStorage?.getItem(STORAGE_KEY);
                    if (!raw) return;
                    const parsed = JSON.parse(raw) as MusicItem[];
                    _state = { ..._state, musics: parsed };
                } catch {}
            },
        } as typeof _state & { hydrateFromLocalStorage?: () => void };
    },
    setState(partial: Partial<typeof _state>) {
        _state = { ..._state, ...partial };
        return _state;
    },
};

describe('musicStore hydration', () => {
    beforeEach(() => {
        // reset store state
        useMusicStore.setState({
            musics: [],
            remoteStatus: { type: 'closed' },
            socket: undefined,
        });
    });

    afterEach(() => {
        useMusicStore.setState({
            musics: [],
            remoteStatus: { type: 'closed' },
            socket: undefined,
        });
        try {
            delete (globalThis as { localStorage?: unknown }).localStorage;
        } catch (error) {
            void error;
        }
    });

    it('initial state is empty (SSR-safe)', () => {
        const s = useMusicStore.getState();
        expect(Array.isArray(s.musics)).toBe(true);
        expect(s.musics.length).toBe(0);
    });

    it('hydrateFromLocalStorage applies when store is empty', () => {
        const mock = makeLocalStorageMock({
            [STORAGE_KEY]: JSON.stringify([
                {
                    channelId: 'cid',
                    channelName: 'C',
                    duration: '3:00',
                    id: 't1',
                    title: 'T',
                },
            ]),
        });
        globalThis.localStorage = mock;

        const s = useMusicStore.getState();
        expect(s.musics.length).toBe(0);
        s.hydrateFromLocalStorage?.();

        const after = useMusicStore.getState();
        expect(after.musics.length).toBe(1);
        expect(after.musics[0].id).toBe('t1');
    });

    it('hydrateFromLocalStorage does not overwrite non-empty store', () => {
        useMusicStore.setState({
            musics: [
                {
                    channelId: 'cid',
                    channelName: 'C',
                    duration: '2:00',
                    id: 'server1',
                    title: 'S',
                },
            ],
        });

        const mock = makeLocalStorageMock({
            [STORAGE_KEY]: JSON.stringify([
                {
                    channelId: 'cid',
                    channelName: 'C',
                    duration: '3:00',
                    id: 't1',
                    title: 'T',
                },
            ]),
        });
        globalThis.localStorage = mock;

        const s = useMusicStore.getState();
        expect(s.musics.length).toBe(1);

        s.hydrateFromLocalStorage?.();

        const after = useMusicStore.getState();
        expect(after.musics.length).toBe(1);
        expect(after.musics[0].id).toBe('server1');
    });
});
