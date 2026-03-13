import { Badge } from '@shadcn/ui/badge';
import { Button } from '@shadcn/ui/button';
import { Card } from '@shadcn/ui/card';
import { Input } from '@shadcn/ui/input';
import { ArrowLeft, History as HistoryIcon, Search } from 'lucide-react';
import { HistoryTable } from '~/components/HistoryTable';

export interface HistoryViewProps {
    filteredHistoryCount: number;
    visibleHistoryItems: import('@/shared/types/history').HistoryItem[];
    remainingHistoryCount: number;
    query: string;
    from: string;
    to: string;
    sort: import('@/shared/types/history').HistorySort;
    setQuery: (q: string) => void;
    setFrom: (s: string) => void;
    setTo: (s: string) => void;
    setSort: (s: import('@/shared/types/history').HistorySort) => void;
    setViewMode: (mode: 'requests' | 'history') => void;
    setVisibleHistoryCount: (n: number) => void;
}

export function HistoryView({
    filteredHistoryCount,
    visibleHistoryItems,
    remainingHistoryCount,
    query,
    from,
    to,
    sort,
    setQuery,
    setFrom,
    setTo,
    setSort,
    setViewMode,
    setVisibleHistoryCount,
}: HistoryViewProps) {
    return (
        <Card className='overflow-hidden gap-0 py-0 shadow-sm'>
            <Card.Header className='px-4 py-4 sm:px-6 sm:py-5'>
                <div className='flex items-start gap-3'>
                    <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/40'>
                        <HistoryIcon className='h-5 w-5' />
                    </div>
                    <div className='space-y-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <Card.Title className='text-lg sm:text-xl'>再生履歴</Card.Title>
                            <Badge
                                variant='secondary'
                                className='rounded-full px-2.5 py-1 text-[11px] sm:text-xs'
                            >
                                {filteredHistoryCount}件
                            </Badge>
                        </div>
                        <Card.Description className='text-xs sm:text-sm'>
                            検索と期間で履歴を絞り込みできます。表示順はテーブル上部のメニューから変更してください。
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
                <div className='flex flex-col gap-4'>
                    <div className='grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)]'>
                        <div className='space-y-2'>
                            <p className='text-xs font-medium text-muted-foreground'>検索</p>
                            <Input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder='曲名やチャンネル名で絞り込む'
                                leftIcon={<Search className='h-4 w-4' />}
                                className='h-11 rounded-xl border-border/40 bg-muted/20'
                            />
                        </div>
                        <div className='space-y-2'>
                            <p className='text-xs font-medium text-muted-foreground'>期間指定</p>
                            <div className='flex items-center gap-2'>
                                <Input
                                    type='date'
                                    value={from}
                                    onChange={e => setFrom(e.target.value)}
                                    className='h-11 flex-1 sm:flex-none sm:w-35 rounded-xl border-border/40 bg-muted/20 px-3'
                                />
                                <span className='text-muted-foreground text-sm font-medium'>〜</span>
                                <Input
                                    type='date'
                                    value={to}
                                    onChange={e => setTo(e.target.value)}
                                    className='h-11 flex-1 sm:flex-none sm:w-35 rounded-xl border-border/40 bg-muted/20 px-3'
                                />
                            </div>
                        </div>
                    </div>

                    <HistoryTable items={visibleHistoryItems} sort={sort} setSort={setSort} />
                    {remainingHistoryCount > 0 && (
                        <div className='flex flex-col items-center gap-2 pt-1'>
                            <p className='text-xs sm:text-sm text-muted-foreground'>
                                残り{remainingHistoryCount}件
                            </p>
                            <Button
                                type='button'
                                variant='outline'
                                className='rounded-xl px-4 h-10'
                                onClick={() => setVisibleHistoryCount(visibleHistoryItems.length + 10)}
                            >
                                もっと表示する{remainingHistoryCount > 10
                                    ? `（+10件）`
                                    : `（残り${remainingHistoryCount}件）`}
                            </Button>
                        </div>
                    )}
                </div>
            </Card.Content>
        </Card>
    );
}

export default HistoryView;
