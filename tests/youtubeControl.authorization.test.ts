import { expect, test } from 'bun:test';
import { RouterContextProvider } from 'react-router';
import { action } from '../src/app/routes/api/youtube.control';
import { serverContext } from '../src/server/context';
import type { ServerContext } from '../src/server/context';
import { loginSession } from '../src/server/sessions.server';

test('playback commands require the current request to carry an admin session', async () => {
    const emitted: unknown[] = [];
    const context = new RouterContextProvider();
    context.set(serverContext, {
        io: {
            io: {
                emit: (...args: unknown[]) => {
                    emitted.push(args);
                },
            },
        },
    } as unknown as ServerContext);
    const send = (cookie?: string) =>
        action({
            request: new Request('http://localhost/api/youtube/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
                body: JSON.stringify({ action: 'next' }),
            }),
            context,
            params: {},
            url: new URL('http://localhost/api/youtube/control'),
            pattern: '/api/youtube/control',
        });
    expect((await send()).status).toBe(403);
    const session = await loginSession.getSession();
    session.set('roles', ['pathfinder']);
    expect((await send(await loginSession.commitSession(session))).status).toBe(403);
    session.set('roles', ['admin']);
    expect((await send(await loginSession.commitSession(session))).status).toBe(200);
    expect((await send()).status).toBe(403);
    expect(emitted).toEqual([['admin_youtube_control_command', { action: 'next' }]]);
});
