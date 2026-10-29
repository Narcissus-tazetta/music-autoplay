import { serverContext } from '@/server/context';
import { isAdminSession, loginSession } from '@/server/sessions.server';
import type { ActionFunctionArgs } from 'react-router';
import { z } from 'zod';

const ControlSchema = z.object({ action: z.enum(['toggle_play_pause', 'prev', 'next', 'skip']) });

export const action = async ({ request, context }: ActionFunctionArgs) => {
    const session = await loginSession.getSession(request.headers.get('Cookie'));
    if (!isAdminSession(session))
        return Response.json({ success: false, error: { message: '管理者ログインが必要です' } }, { status: 403 });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ success: false, error: { message: '不正なJSONです' } }, { status: 400 });
    }
    const parsed = ControlSchema.safeParse(body);
    if (!parsed.success)
        return Response.json({ success: false, error: { message: '不正な再生操作です' } }, { status: 400 });

    const { io } = context.get(serverContext);
    if (!io.io)
        return Response.json({ success: false, error: { message: '再生サーバーに接続できません' } }, { status: 503 });
    io.io.emit('admin_youtube_control_command', parsed.data);
    return Response.json({ success: true, data: {} });
};
