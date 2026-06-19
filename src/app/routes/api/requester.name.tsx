import { normalizeRequesterDisplayName, resolveRequesterIdentity } from '@/app/requesterIdentity.server';
import { requesterDisplayNameCookie } from '@/app/sessions.server';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const identity = await resolveRequesterIdentity(request.headers.get('Cookie'));
    return Response.json({
        requesterHash: identity.requesterHash,
        requesterName: identity.requesterName,
    });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const formData = await request.formData();
    const requesterName = normalizeRequesterDisplayName(formData.get('requesterName'));

    if (!requesterName) {
        return Response.json(
            { error: '表示名を1文字以上で入力してください', ok: false },
            { status: 400 },
        );
    }

    return Response.json(
        { ok: true, requesterName },
        {
            headers: {
                'Set-Cookie': await requesterDisplayNameCookie.serialize(requesterName),
            },
        },
    );
};

export default function RequesterNameRoute() {
    return null;
}
