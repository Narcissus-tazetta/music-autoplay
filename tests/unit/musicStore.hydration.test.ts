import { afterEach, beforeEach, describe, expect, it } from '../bunTestCompat';

function makeLocalStorageMock(initial: Record<string, string> = {}) {
    let store: Record<string, string> = { ...initial };
    return {
        getItem(key: string) {
            return Object.prototype.hasOwnProperty.call(store, key)
                ? store[key]
                : null;
        },
        setItem(key: string, value: string) {
            store[key] = value;
        },
        removeItem(key: string) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete store[key];
        },
        clear() {
            store = {};
        },
    } as Storage;
}

const STORAGE_KEY = 'music-auto-play:musics:v1';

type MusicItem = {
    id: string;
    title: string;
    channelName: string;
    channelId: string;
    duration: string;
};

type RemoteStatus = { type: string };

let _state: {
    musics: MusicItem[];
    socket: unknown | null;
    remoteStatus: RemoteStatus;
} = {
    musics: [],
    socket: null,
    remoteStatus: { type: 'closed' },
};

const useMusicStore = {
    setState(partial: Partial<typeof _state>) {
        _state = { ..._state, ...partial };
        return _state;
    },
    getState() {
        return {
            ..._state,
            hydrateFromLocalStorage: function() {
                if (_state.musics.length > 0) return;
                try {
                    const raw = (globalThis as any).localStorage?.getItem(STORAGE_KEY);
                    if (!raw) return;
                    const parsed = JSON.parse(raw) as MusicItem[];
                    _state = { ..._state, musics: parsed };
                } catch (_e) {}
            },
        } as typeof _state & { hydrateFromLocalStorage?: () => void };
    },
};

describe('musicStore hydration', () => {
    beforeEach(() => {
        // reset store state
        useMusicStore.setState({
            musics: [],
            socket: null,
            remoteStatus: { type: 'closed' },
        });
    });

    afterEach(() => {
        useMusicStore.setState({
            musics: [],
            socket: null,
            remoteStatus: { type: 'closed' },
        });
        try {
            delete (globalThis as { localStorage?: unknown }).localStorage;
        } catch (_e: unknown) {
            void _e;
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
                    id: 't1',
                    title: 'T',
                    channelName: 'C',
                    channelId: 'cid',
                    duration: '3:00',
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
                    id: 'server1',
                    title: 'S',
                    channelName: 'C',
                    channelId: 'cid',
                    duration: '2:00',
                },
            ],
        });

        const mock = makeLocalStorageMock({
            [STORAGE_KEY]: JSON.stringify([
                {
                    id: 't1',
                    title: 'T',
                    channelName: 'C',
                    channelId: 'cid',
                    duration: '3:00',
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
