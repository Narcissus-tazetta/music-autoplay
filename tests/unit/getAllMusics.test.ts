import type { Socket } from 'socket.io';
import { createGetAllMusicsHandler } from '../../src/server/socket/handlers/standardHandlers';
import type { Music } from '../../src/shared/schemas/music';
import { describe, expect, it } from '../bunTestCompat';

describe('getAllMusics', () => {
    it('returns all musics from musicDB via callback', async () => {
        const musicDB = new Map<string, Music>();
        musicDB.set('a1', { id: 'a1', title: 'One' } as Music);
        musicDB.set('b2', { id: 'b2', title: 'Two' } as Music);

        const handlers: Record<string, (...args: unknown[]) => void> = {};
        const socketStub = {
            id: 'stub-socket',
            on: (ev: string, cb: (...args: unknown[]) => void) => {
                handlers[ev] = cb;
                return socketStub;
            },
        } as unknown as Socket;

        const registerHandler = createGetAllMusicsHandler(musicDB);
        registerHandler(socketStub, {
            connectionId: 'test-conn',
            socketId: 'stub-socket',
        });

        const resultPromise = new Promise<unknown>(resolve => {
            const callback = (response: unknown) => {
                resolve(response);
            };

            handlers['getAllMusics']?.({}, callback);
        });

        const result = await resultPromise;

        expect(Array.isArray(result)).toBe(true);
        const ids = (Array.isArray(result) ? result : [])
            .map((m: unknown) => String((m as Record<string, unknown>).id))
            // oxlint-disable-next-line no-array-sort
            .sort();
        expect(ids).toEqual(['a1', 'b2']);
    });
});
