import useFormErrors from '@/app/hooks/useFormErrors';
import { useMusicForm } from '@/app/hooks/useMusicForm';
import usePlayingMusic from '@/app/hooks/usePlayingMusic';
import { useSettingsSync } from '@/app/hooks/useSettingsSync';
import { useUiActionExecutor } from '@/app/hooks/useUiActionExecutor';
import { StatusBadge } from '@/shared/components';
import { useMusicStore } from '@/shared/stores/musicStore';
import { safeExecuteAsync } from '@/shared/utils/errors';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import { watchUrl } from '@/shared/utils/youtube';
import { createHash } from 'crypto';
import { AnimatePresence } from 'framer-motion';
import { useCallback } from 'react';
import { useLoaderData } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { MusicForm } from '~/components/MusicForm';
import { MusicTable } from '~/components/MusicTable';
import { loginSession } from '~/sessions.server';
import { useAdminStore } from '../../shared/stores/adminStore';

export const meta = () => [
    { title: '楽曲リクエストフォーム' },
    {
        name: 'description',
        content: '浜松キャンパスの楽曲リクエストフォームです。',
    },
];

export const loader = async ({ request }: ActionFunctionArgs) => {
    const res = await safeExecuteAsync(async () => {
        const session = await loginSession.getSession(request.headers.get('Cookie'));
        const user = session.get('user');

        return {
            userHash: user ? createHash('sha256').update(user.id).digest('hex') : undefined,
        };
    });

    if (!res.ok) {
        const errVal = res.error as unknown;
        let message = 'loader error';
        let code: string | undefined = undefined;
        if (errVal && typeof errVal === 'object' && 'message' in (errVal as Record<string, unknown>)) {
            const m = (errVal as Record<string, unknown>).message;
            if (typeof m === 'string') message = m;
        }
        if (errVal && typeof errVal === 'object' && 'code' in (errVal as Record<string, unknown>)) {
            const c = (errVal as Record<string, unknown>).code;
            if (typeof c === 'string') code = c;
        }
        return respondWithResult(makeErr({ message, code }));
    }
    return res.value;
};

export default function Home() {
    const { userHash } = useLoaderData<typeof loader>();

    const { musics, remoteStatus } = useMusicStore(
        useShallow(state => ({
            musics: state.musics,
            remoteStatus: state.remoteStatus,
        })),
    );
    const { ytStatusMode } = useSettingsSync();
    const playingMusic = usePlayingMusic(musics, remoteStatus);
    const isAdmin = useAdminStore(s => s.isAdmin);
    const { fetcher, form, fields, isSubmitting, canSubmit, retryAfter } = useMusicForm();
    const { parsedAction } = useFormErrors(fetcher.data);

    useUiActionExecutor({
        parsedAction,
        conformFields: fields,
    });

    const handleDelete = useCallback(
        (id: string, asAdmin?: boolean) => {
            const formData = new FormData();
            formData.append('url', watchUrl(id));
            if (asAdmin) formData.append('isAdmin', 'true');
            void fetcher.submit(formData, {
                method: 'post',
                action: '/api/music/remove',
            });
        },
        [fetcher],
    );

    return (
        <div className='flex flex-col w-full max-w-4xl gap-4 sm:gap-5 px-3 sm:px-4 mt-8 sm:mt-12 pb-6 sm:pb-8'>
            <fetcher.Form method='post' action='/api/music/add' id={form.id}>
                <MusicForm
                    formId={form.id}
                    urlFieldName={fields.url.name}
                    urlFieldErrors={fields.url.errors as readonly string[] | undefined}
                    isSubmitting={isSubmitting}
                    canSubmit={canSubmit}
                    retryAfter={retryAfter}
                />
            </fetcher.Form>

            <div className='w-full mt-2 sm:mt-4 flex justify-center'>
                <AnimatePresence mode='wait'>
                    {remoteStatus && <StatusBadge mode={ytStatusMode} status={remoteStatus} music={playingMusic} />}
                </AnimatePresence>
            </div>

            <MusicTable
                musics={musics}
                userHash={userHash}
                isAdmin={isAdmin}
                isDeleting={isSubmitting}
                onDelete={handleDelete}
            />
        </div>
    );
}
