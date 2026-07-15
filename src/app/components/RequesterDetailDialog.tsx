import type { Music } from '@/shared/stores/musicStore';
import type { MaskedRequestLogEntry } from '@/shared/types/requestLog';
import { formatRequestedAt } from '@/shared/utils/format';
import { Badge } from '@shadcn/ui/badge';
import { Button } from '@shadcn/ui/button';
import { Card } from '@shadcn/ui/card';
import { Dialog } from '@shadcn/ui/dialog';
import { Input } from '@shadcn/ui/input';
import { Table } from '@shadcn/ui/table';
import { Check, Loader, Pencil, TrashIcon, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useFetcher } from 'react-router';

export interface RequesterSelection {
    requesterHash?: string;
    requesterName: string;
}

export interface RequesterDetailDialogProps {
    isAdmin: boolean;
    /** Whether the viewer may see the requester's request logs (admin and pathfinder roles). */
    canViewLogs?: boolean;
    isDeleting?: boolean;
    onRequesterNameChange?: (requesterName: string) => void;
    onDelete: (id: string, asAdmin?: boolean) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    queueMusics: Music[];
    requester: RequesterSelection | null;
    userHash?: string;
}

const requesterDisplayName = (requester?: RequesterSelection | null): string => {
    if (!requester) return 'unknown';
    return requester.requesterName || 'guest';
};

export function RequesterDetailDialog({
    isAdmin,
    canViewLogs = false,
    isDeleting = false,
    onRequesterNameChange,
    onDelete,
    onOpenChange,
    open,
    queueMusics,
    requester,
    userHash,
}: RequesterDetailDialogProps) {
    const [logs, setLogs] = useState<MaskedRequestLogEntry[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [logError, setLogError] = useState<string | null>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editableName, setEditableName] = useState(requesterDisplayName(requester));
    const displayNameFetcher = useFetcher<{
        error?: string;
        ok?: boolean;
        requesterName?: string;
    }>();

    const requesterHash = requester?.requesterHash;
    const isSelf = !!requesterHash && requesterHash === userHash;
    const hashPrefix = requesterHash?.slice(0, 8);
    const displayedRequesterName = displayNameFetcher.data?.requesterName ?? editableName;

    useEffect(() => {
        const nextName = requesterDisplayName(requester);
        setEditableName(nextName);
        setIsEditingName(false);
    }, [requester]);

    useEffect(() => {
        if (!displayNameFetcher.data?.ok || !displayNameFetcher.data.requesterName) return;
        setEditableName(displayNameFetcher.data.requesterName);
        setIsEditingName(false);
        onRequesterNameChange?.(displayNameFetcher.data.requesterName);
    }, [displayNameFetcher.data, onRequesterNameChange]);

    useEffect(() => {
        if (!open || !canViewLogs || !requesterHash) {
            setLogs([]);
            setLogError(null);
            setIsLoadingLogs(false);
            return;
        }

        const controller = new AbortController();
        const fetchLogs = async () => {
            setIsLoadingLogs(true);
            setLogError(null);
            try {
                const response = await fetch('/api/admin/request-logs/query', {
                    body: JSON.stringify({ limit: 100, requesterHash }),
                    headers: { 'Content-Type': 'application/json' },
                    method: 'POST',
                    signal: controller.signal,
                });
                if (!response.ok) {
                    setLogError(
                        response.status === 401
                            ? '管理者ログインが必要です'
                            : 'ログの取得に失敗しました',
                    );
                    setLogs([]);
                    return;
                }
                const data = await response.json() as { entries?: MaskedRequestLogEntry[] };
                setLogs(Array.isArray(data.entries) ? data.entries : []);
            } catch (error) {
                if ((error as { name?: string })?.name === 'AbortError') return;
                setLogError('ログの取得に失敗しました');
                setLogs([]);
            } finally {
                if (!controller.signal.aborted) setIsLoadingLogs(false);
            }
        };

        void fetchLogs();
        return () => controller.abort();
    }, [canViewLogs, hashPrefix, open, requesterHash]);

    const latestLogAt = useMemo(() => {
        if (logs.length === 0) return undefined;
        return logs[0]?.requestedAt;
    }, [logs]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <Dialog.Content className='max-w-2xl'>
                <Dialog.Header>
                    <div className='flex items-start gap-3'>
                        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/40'>
                            <UserRound className='h-5 w-5' />
                        </div>
                        <div className='space-y-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Dialog.Title>リクエスター詳細</Dialog.Title>
                                {isSelf && <Badge variant='secondary'>あなた</Badge>}
                                {isAdmin && <Badge variant='outline'>Admin</Badge>}
                            </div>
                            <Dialog.Description>
                                {requesterHash
                                    ? '同じ匿名IDのリクエスト情報です。通常ユーザーには現在のキュー内だけ表示されます。'
                                    : 'このリクエストは匿名IDが付く前、またはCookie未取得時のリクエストです。'}
                            </Dialog.Description>
                        </div>
                    </div>
                </Dialog.Header>

                {!requesterHash
                    ? (
                        <Card className='p-4 text-sm text-muted-foreground'>
                            この `guest` は同一人物判定に必要な匿名IDを持っていません。
                            そのため、同じ人の他のリクエストは特定できません。
                        </Card>
                    )
                    : (
                        <div className='space-y-4'>
                            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                                <Card className='gap-1 p-4'>
                                    <p className='text-xs text-muted-foreground'>匿名ID</p>
                                    <p className='font-mono text-sm font-semibold'>{hashPrefix}...</p>
                                </Card>
                                <Card className='relative gap-1 p-4'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <p className='text-xs text-muted-foreground'>表示名</p>
                                        {isSelf && !isEditingName && (
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='icon'
                                                className='-mt-2 -mr-2 h-7 w-7 text-muted-foreground hover:text-foreground'
                                                aria-label='表示名を編集'
                                                onClick={() => setIsEditingName(true)}
                                            >
                                                <Pencil className='h-3.5 w-3.5' />
                                            </Button>
                                        )}
                                    </div>
                                    {isSelf && isEditingName
                                        ? (
                                            <displayNameFetcher.Form
                                                method='post'
                                                action='/api/requester/name'
                                                className='space-y-2'
                                            >
                                                <Input
                                                    name='requesterName'
                                                    value={editableName}
                                                    maxLength={24}
                                                    onChange={event => setEditableName(event.currentTarget.value)}
                                                    autoComplete='nickname'
                                                    aria-label='表示名'
                                                    className='h-8 text-sm font-semibold'
                                                    autoFocus
                                                />
                                                <div className='flex items-center justify-end gap-1'>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='h-7 w-7'
                                                        onClick={() => {
                                                            setEditableName(requesterDisplayName(requester));
                                                            setIsEditingName(false);
                                                        }}
                                                        aria-label='表示名編集をキャンセル'
                                                    >
                                                        <X className='h-3.5 w-3.5' />
                                                    </Button>
                                                    <Button
                                                        type='submit'
                                                        variant='ghost'
                                                        size='icon'
                                                        className='h-7 w-7'
                                                        disabled={displayNameFetcher.state !== 'idle'}
                                                        aria-label='表示名を保存'
                                                    >
                                                        {displayNameFetcher.state !== 'idle'
                                                            ? <Loader className='h-3.5 w-3.5 animate-spin' />
                                                            : <Check className='h-3.5 w-3.5' />}
                                                    </Button>
                                                </div>
                                                {displayNameFetcher.data?.error && (
                                                    <p className='text-xs text-destructive'>
                                                        {displayNameFetcher.data.error}
                                                    </p>
                                                )}
                                            </displayNameFetcher.Form>
                                        )
                                        : <p className='text-sm font-semibold'>{displayedRequesterName}</p>}
                                </Card>
                                <Card className='gap-1 p-4'>
                                    <p className='text-xs text-muted-foreground'>キュー内</p>
                                    <p className='text-sm font-semibold'>{queueMusics.length}曲</p>
                                </Card>
                            </div>

                            <section className='space-y-2'>
                                <div className='flex items-center justify-between gap-2'>
                                    <h3 className='text-sm font-semibold'>現在キュー内の同じリクエスター</h3>
                                    <Badge variant='secondary'>{queueMusics.length}件</Badge>
                                </div>
                                <RequesterMusicTable
                                    isAdmin={isAdmin}
                                    isDeleting={isDeleting}
                                    musics={queueMusics}
                                    onDelete={onDelete}
                                    userHash={userHash}
                                />
                            </section>

                            {canViewLogs && (
                                <section className='space-y-2'>
                                    <div className='flex flex-wrap items-center justify-between gap-2'>
                                        <div>
                                            <h3 className='text-sm font-semibold'>Adminログ（直近30日）</h3>
                                            {latestLogAt && (
                                                <p className='text-xs text-muted-foreground'>
                                                    最新: {new Date(latestLogAt).toLocaleString('ja-JP')}
                                                </p>
                                            )}
                                        </div>
                                        <Badge variant='outline'>{logs.length}件</Badge>
                                    </div>
                                    {logError && <p className='text-sm text-destructive'>{logError}</p>}
                                    {isLoadingLogs
                                        ? (
                                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                                <Loader className='h-4 w-4 animate-spin' />
                                                読み込み中...
                                            </div>
                                        )
                                        : <RequestLogTable logs={logs} />}
                                </section>
                            )}
                        </div>
                    )}
            </Dialog.Content>
        </Dialog>
    );
}

function RequesterMusicTable({
    isAdmin,
    isDeleting,
    musics,
    onDelete,
    userHash,
}: {
    isAdmin: boolean;
    isDeleting?: boolean;
    musics: Music[];
    onDelete: (id: string, asAdmin?: boolean) => void;
    userHash?: string;
}) {
    if (musics.length === 0)
        return <p className='rounded-lg border p-4 text-sm text-muted-foreground'>現在キュー内にはありません。</p>;

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>曲名</Table.Head>
                    <Table.Head className='w-28'>リクエスト</Table.Head>
                    <Table.Head className='w-12 text-right'>操作</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {musics.map(music => {
                    const canDelete = isAdmin || (!!music.requesterHash && music.requesterHash === userHash);
                    return (
                        <Table.Row key={music.id}>
                            <Table.Cell className='min-w-0 whitespace-normal'>
                                <p className='line-clamp-2 text-sm font-medium'>{music.title}</p>
                                <p className='text-xs text-muted-foreground'>{music.channelName}</p>
                            </Table.Cell>
                            <Table.Cell className='text-xs text-muted-foreground'>
                                {formatRequestedAt(music.requestedAt)}
                            </Table.Cell>
                            <Table.Cell className='text-right'>
                                {canDelete && (
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='icon'
                                        className='h-8 w-8 text-destructive hover:text-destructive/80'
                                        disabled={isDeleting}
                                        onClick={() => onDelete(music.id, isAdmin)}
                                        aria-label={`${music.title} を削除`}
                                    >
                                        {isDeleting
                                            ? <Loader className='h-4 w-4 animate-spin' />
                                            : <TrashIcon className='h-4 w-4' />}
                                    </Button>
                                )}
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}

function RequestLogTable({ logs }: { logs: MaskedRequestLogEntry[] }) {
    if (logs.length === 0)
        return <p className='rounded-lg border p-4 text-sm text-muted-foreground'>ログがありません。</p>;

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>曲名</Table.Head>
                    <Table.Head className='w-40'>日時</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {logs.map(log => (
                    <Table.Row key={log.id}>
                        <Table.Cell className='min-w-0 whitespace-normal'>
                            <p className='line-clamp-2 text-sm font-medium'>{log.title}</p>
                            <p className='font-mono text-xs text-muted-foreground'>{log.musicId}</p>
                        </Table.Cell>
                        <Table.Cell className='whitespace-nowrap text-xs text-muted-foreground'>
                            {new Date(log.requestedAt).toLocaleString('ja-JP')}
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
