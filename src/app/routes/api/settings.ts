import { loginSession } from '@/server/sessions.server';
import { getSettingsStore } from '@/server/settingsPersistence.server';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';

/** Only the keys the UI actually syncs. The schema used to pass unknown keys straight
 * through to disk, which let any signed-in caller store arbitrary JSON of any size. */
const SettingsSchema = z.object({
    ytAdminControlsEnabled: z.boolean().optional(),
    ytStatusMode: z.enum(['compact', 'player']).optional(),
    ytStatusVisible: z.boolean().optional(),
}).strict();

const MAX_BODY_BYTES = 2_048;

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const session = await loginSession.getSession(request.headers.get('Cookie'));
    const user = session.get('user');
    // Anonymous visitors have nothing stored; 204 says so without a body to parse.
    if (!user?.id) return new Response(undefined, { status: 204 });

    const stored = getSettingsStore().load(user.id);
    return Response.json(stored?.value ?? {});
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const session = await loginSession.getSession(request.headers.get('Cookie'));
    const user = session.get('user');
    if (!user?.id) {
        // An admin without a Google account has no per-user row to write to; that is not an
        // error, the settings simply stay client-side.
        if (session.get('admin') === true) return new Response(undefined, { status: 204 });
        return Response.json({ error: 'unauthorized', ok: false }, { status: 401 });
    }

    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return Response.json({ error: 'payload_too_large', ok: false }, { status: 413 });

    const parsed = SettingsSchema.safeParse(parseJson(body));
    if (!parsed.success) return Response.json({ error: 'invalid_settings', ok: false }, { status: 400 });

    getSettingsStore().save(user.id, parsed.data);
    return Response.json({ ok: true });
};

function parseJson(body: string): unknown {
    try {
        return JSON.parse(body);
    } catch {
        return undefined;
    }
}
