import useFormErrors from '@/app/hooks/useFormErrors';
import { useHistoryJapaneseReadings } from '@/app/hooks/useHistoryJapaneseReadings';
import { useMusicForm } from '@/app/hooks/useMusicForm';
import usePlayingMusic from '@/app/hooks/usePlayingMusic';
import { useSettingsSync } from '@/app/hooks/useSettingsSync';
import { useUiActionExecutor } from '@/app/hooks/useUiActionExecutor';
import { StatusBadge, Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components';
import { INSERT_AT_END, INSERT_AT_FRONT } from '@/shared/schemas/music';
import { useHistoryStore } from '@/shared/stores/historyStore';
import { useMusicStore } from '@/shared/stores/musicStore';
import { normalizeApiResponse } from '@/shared/utils/api';
import { safeExecuteAsync } from '@/shared/utils/errors';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import { watchUrl } from '@/shared/utils/youtube';
import { Button } from '@shadcn/ui/button';
import { AnimatePresence } from 'framer-motion';
import { History as HistoryIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import HistoryView from '~/components/HistoryView';
import type { InsertAfterOption } from '~/components/MusicForm';
import { MusicForm } from '~/components/MusicForm';
import { MusicTable } from '~/components/MusicTable';
import { RequesterDetailDialog, type RequesterSelection } from '~/components/RequesterDetailDialog';
import { resolveRequesterIdentity } from '~/requesterIdentity.server';
import { historyItemMatchesSearch } from '~/utils/historySearchSuggestions';
import { useAdminStore } from '../../shared/stores/adminStore';
import { useHomeViewStore } from '../../shared/stores/homeViewStore';

// Stable reference so the memoized MusicForm doesn't re-render on every queue update.
const EMPTY_INSERT_OPTIONS: InsertAfterOption[] = [];

export const meta = () => [
    { title: '楽曲リクエストフォーム' },
    {
        content: '浜松キャンパスの楽曲リクエストフォームです。',
        name: 'description',
    },
];

export const loader = async ({ request }: ActionFunctionArgs) => {
    const res = await safeExecuteAsync(async () => {
        const identity = await resolveRequesterIdentity(request.headers.get('Cookie'));

        return {
            requesterName: identity.requesterName,
            userHash: identity.requesterHash,
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
        return respondWithResult(makeErr({ code, message }));
    }
    return res.value;
};

export default function Home() {
    const { userHash } = useLoaderData<typeof loader>();
    const { viewMode, setViewMode } = useHomeViewStore(
        useShallow(state => ({
            setViewMode: state.setViewMode,
            viewMode: state.viewMode,
        })),
    );
    const [visibleHistoryCount, setVisibleHistoryCount] = useState(10);
    const [selectedRequester, setSelectedRequester] = useState<RequesterSelection | null>(null);
    const [reorderResyncToken, setReorderResyncToken] = useState(0);
    const [reorderError, setReorderError] = useState<string | null>(null);

    const { musics, remoteStatus } = useMusicStore(
        useShallow(state => ({
            musics: state.musics,
            remoteStatus: state.remoteStatus,
        })),
    );
    const { ytStatusMode } = useSettingsSync();
    const playingMusic = usePlayingMusic(musics, remoteStatus);
    const isAdmin = useAdminStore(s => s.isAdmin);
    const hasPathfinderAccess = useAdminStore(s => s.hasPathfinderAccess);
    const { fetcher, form, fields, isSubmitting, canSubmit, retryAfter } = useMusicForm();
    const { parsedAction } = useFormErrors(fetcher.data);
    const {
        items: historyItems,
        query,
        from,
        to,
        sort,
        setQuery,
        setFrom,
        setTo,
        setSort,
        connectSocket: connectHistorySocket,
        fetchHistory,
    } = useHistoryStore(
        useShallow(state => ({
            connectSocket: state.connectSocket,
            fetchHistory: state.fetchHistory,
            from: state.from,
            items: state.items,
            query: state.query,
            setFrom: state.setFrom,
            setQuery: state.setQuery,
            setSort: state.setSort,
            setTo: state.setTo,
            sort: state.sort,
            to: state.to,
        })),
    );

    useUiActionExecutor({
        conformFields: fields,
        parsedAction,
    });

    useEffect(() => {
        connectHistorySocket();
    }, [connectHistorySocket]);

    useEffect(() => {
        if (viewMode !== 'history') return;
        setVisibleHistoryCount(10);
        const timer = setTimeout(() => {
            fetchHistory({
                from: from || undefined,
                sort,
                to: to || undefined,
            });
        }, 180);
        return () => clearTimeout(timer);
    }, [fetchHistory, from, sort, to, viewMode]);

    const handleDelete = useCallback(
        (id: string, asAdmin?: boolean) => {
            const formData = new FormData();
            formData.append('url', watchUrl(id));
            if (asAdmin) formData.append('isAdmin', 'true');
            void fetcher.submit(formData, {
                action: '/api/music/remove',
                method: 'post',
            });
        },
        [fetcher],
    );

    const handleReorder = useCallback(
        (id: string, afterId: string) => {
            // Deliberately bypasses the shared `fetcher` used by add/delete: reusing it would
            // route a reorder response through the add-music success/error toast logic and
            // would flip `isSubmitting` (disabling the add form and every row's delete button)
            // for the duration of the drag's network request.
            const formData = new FormData();
            formData.append('id', id);
            formData.append('afterId', afterId);
            void (async () => {
                let errorMessage: string | null = null;
                try {
                    const response = await fetch('/api/music/reorder', {
                        body: formData,
                        method: 'POST',
                    });
                    const normalized = await normalizeApiResponse(response);
                    if (!normalized.success) errorMessage = normalized.error.message;
                } catch {
                    errorMessage = '';
                }
                if (errorMessage != null) {
                    setReorderResyncToken(n => n + 1);
                    setReorderError(errorMessage || '楽曲の並び替えに失敗しました');
                }
            })();
        },
        [],
    );

    useEffect(() => {
        if (!reorderError) return;
        const timer = setTimeout(() => setReorderError(null), 5000);
        return () => clearTimeout(timer);
    }, [reorderError]);

    const historySearchReadings = useHistoryJapaneseReadings(historyItems, viewMode === 'history');
    const filteredHistoryItems = useMemo(
        () => historyItems.filter(item => historyItemMatchesSearch(item, query, historySearchReadings)),
        [historyItems, historySearchReadings, query],
    );
    const filteredHistoryCount = filteredHistoryItems.length;
    const visibleHistoryItems = filteredHistoryItems.slice(0, visibleHistoryCount);
    const remainingHistoryCount = Math.max(filteredHistoryCount - visibleHistoryItems.length, 0);
    const selectedRequesterQueue = useMemo(() => {
        if (!selectedRequester?.requesterHash) return [];
        return musics.filter(music => music.requesterHash === selectedRequester.requesterHash);
    }, [musics, selectedRequester?.requesterHash]);
    const insertAfterOptions = useMemo(() => {
        if (!hasPathfinderAccess || musics.length === 0) return EMPTY_INSERT_OPTIONS;
        const ordered = playingMusic
            ? [playingMusic, ...musics.filter(m => m.id !== playingMusic.id)]
            : musics;
        return [
            { id: INSERT_AT_FRONT, isFront: true, title: '' },
            ...ordered.map(m => ({ id: m.id, isPlaying: m.id === playingMusic?.id, title: m.title })),
            { id: INSERT_AT_END, isEnd: true, title: '' },
        ];
    }, [hasPathfinderAccess, musics, playingMusic]);
    const handleRequesterNameChange = useCallback((requesterName: string) => {
        setSelectedRequester(current => (current ? { ...current, requesterName } : current));
    }, []);

    return (
        <div className='flex flex-col w-full max-w-5xl gap-4 sm:gap-5 px-3 sm:px-4 mt-8 sm:mt-12 pb-6 sm:pb-8'>
            <RequesterDetailDialog
                isAdmin={isAdmin}
                canViewLogs={hasPathfinderAccess}
                isDeleting={isSubmitting}
                onDelete={handleDelete}
                onRequesterNameChange={handleRequesterNameChange}
                onOpenChange={open => {
                    if (!open) setSelectedRequester(null);
                }}
                open={selectedRequester !== null}
                queueMusics={selectedRequesterQueue}
                requester={selectedRequester}
                userHash={userHash}
            />
            <fetcher.Form method='post' action='/api/music/add' id={form.id}>
                <MusicForm
                    formId={form.id}
                    urlFieldName={fields.url.name}
                    urlFieldErrors={fields.url.errors as readonly string[] | undefined}
                    isSubmitting={isSubmitting}
                    canSubmit={canSubmit}
                    retryAfter={retryAfter}
                    insertAfterFieldName={fields.insertAfterId.name}
                    insertAfterOptions={insertAfterOptions}
                    showInsertAfterField={hasPathfinderAccess}
                />
            </fetcher.Form>

            <div className='w-full mt-2 sm:mt-4 flex justify-center'>
                <AnimatePresence mode='wait'>
                    {remoteStatus && <StatusBadge mode={ytStatusMode} status={remoteStatus} music={playingMusic} />}
                </AnimatePresence>
            </div>

            {viewMode === 'history'
                ? (
                    <HistoryView
                        filteredHistoryCount={filteredHistoryCount}
                        historyItems={historyItems}
                        historySearchReadings={historySearchReadings}
                        visibleHistoryItems={visibleHistoryItems}
                        remainingHistoryCount={remainingHistoryCount}
                        query={query}
                        from={from}
                        to={to}
                        sort={sort}
                        setQuery={setQuery}
                        setFrom={setFrom}
                        setTo={setTo}
                        setSort={setSort}
                        setViewMode={setViewMode}
                        setVisibleHistoryCount={setVisibleHistoryCount}
                    />
                )
                : (
                    <>
                        {reorderError && (
                            <p className='text-sm text-destructive font-medium text-center' role='alert'>
                                {reorderError}
                            </p>
                        )}
                        <MusicTable
                            musics={musics}
                            userHash={userHash}
                            isAdmin={isAdmin}
                            canReorder={hasPathfinderAccess}
                            isDeleting={isSubmitting}
                            onDelete={handleDelete}
                            onReorder={handleReorder}
                            reorderResyncToken={reorderResyncToken}
                            onRequesterClick={setSelectedRequester}
                            headerAction={
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type='button'
                                            variant='ghost'
                                            size='icon'
                                            aria-label='履歴'
                                            className='h-9 w-9 p-0 rounded-md text-muted-foreground hover:bg-accent/30'
                                            onClick={() => {
                                                setViewMode('history');
                                                setVisibleHistoryCount(10);
                                                fetchHistory({
                                                    from: from || undefined,
                                                    sort,
                                                    to: to || undefined,
                                                });
                                            }}
                                        >
                                            <HistoryIcon className='h-4 w-4' />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>履歴を見る</TooltipContent>
                                </Tooltip>
                            }
                        />
                    </>
                )}
        </div>
    );
}
