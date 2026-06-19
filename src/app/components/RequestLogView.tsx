import type { MaskedRequestLogEntry } from '@/shared/types/requestLog';
import { Badge } from '@shadcn/ui/badge';
import { Button } from '@shadcn/ui/button';
import { Card } from '@shadcn/ui/card';
import { Table } from '@shadcn/ui/table';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export interface RequestLogViewProps {
    setViewMode: (mode: 'requests' | 'history' | 'requestLogs') => void;
}

export function RequestLogView({ setViewMode }: RequestLogViewProps) {
    const [entries, setEntries] = useState<MaskedRequestLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/request-logs?limit=50');
            if (!response.ok) {
                setError(
                    response.status === 401
                        ? '管理者ログインが必要です'
                        : 'リクエストログの取得に失敗しました',
                );
                setEntries([]);
                return;
            }
            const data = await response.json() as { entries?: MaskedRequestLogEntry[] };
            setEntries(Array.isArray(data.entries) ? data.entries : []);
        } catch {
            setError('リクエストログの取得に失敗しました');
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchLogs();
        const timer = setInterval(() => {
            void fetchLogs();
        }, 5000);
        return () => clearInterval(timer);
    }, [fetchLogs]);

    return (
        <Card className='overflow-hidden gap-0 py-0 shadow-sm'>
            <Card.Header className='px-4 py-4 sm:px-6 sm:py-5'>
                <div className='flex items-start gap-3'>
                    <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/40'>
                        <ClipboardList className='h-5 w-5' />
                    </div>
                    <div className='space-y-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Card.Title className='text-lg sm:text-xl'>リクエストログ</Card.Title>
                            <Badge
                                variant='secondary'
                                className='rounded-full px-2.5 py-1 text-[11px] sm:text-xs'
                            >
                                {entries.length}件
                            </Badge>
                        </div>
                        <Card.Description className='text-xs sm:text-sm'>
                            匿名ユーザーID（先頭8文字）ごとのリクエスト履歴です。直近30日分を保持します。
                        </Card.Description>
                    </div>
                </div>
                <Card.Action>
                    <Button
                        type='button'
                        variant='outline'
                        className='h-10 rounded-xl px-4'
                        onClick={() => setViewMode('requests')}
                    >
                        <ArrowLeft className='h-4 w-4' />
                        戻る
                    </Button>
                </Card.Action>
            </Card.Header>
            <Card.Content className='px-4 py-4 sm:px-6 sm:py-5'>
                {error && <p className='mb-4 text-sm text-destructive'>{error}</p>}
                {isLoading && entries.length === 0 && !error
                    ? <p className='text-sm text-muted-foreground'>読み込み中...</p>
                    : (
                        <div className='overflow-x-auto'>
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>ユーザーID</Table.Head>
                                        <Table.Head>表示名</Table.Head>
                                        <Table.Head>タイトル</Table.Head>
                                        <Table.Head>リクエスト日時</Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {entries.length === 0
                                        ? (
                                            <Table.Row>
                                                <Table.Cell colSpan={4} className='text-center text-muted-foreground'>
                                                    ログがありません
                                                </Table.Cell>
                                            </Table.Row>
                                        )
                                        : entries.map(entry => (
                                            <Table.Row key={entry.id}>
                                                <Table.Cell className='font-mono text-xs'>
                                                    {entry.requesterHash}
                                                </Table.Cell>
                                                <Table.Cell>{entry.requesterName}</Table.Cell>
                                                <Table.Cell>{entry.title}</Table.Cell>
                                                <Table.Cell className='whitespace-nowrap text-xs'>
                                                    {new Date(entry.requestedAt).toLocaleString('ja-JP')}
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                </Table.Body>
                            </Table>
                        </div>
                    )}
            </Card.Content>
        </Card>
    );
}
