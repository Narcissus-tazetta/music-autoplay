import { useMusicSubmissionFeedback } from '@/app/hooks/useMusicSubmissionFeedback';
import { cn } from '@/app/utils/cn';
import { MusicTitleWithHover } from '@/shared/components';
import type { HistoryItem } from '@/shared/types/history';
import { watchUrl } from '@/shared/utils/youtube';
import { Table } from '@shadcn/ui/table';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock3, Loader, Radio, Repeat2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '~/components/ui/shadcn/button';

export interface HistoryTableRowProps {
    item: HistoryItem;
    index: number;
    className?: string;
}

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

function formatDate(value: string): string {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return '-';
    return dateTimeFormatter.format(parsed);
}

function HistoryTableRow({
    item,
    index,
    className,
}: HistoryTableRowProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const rerequestFetcher = useFetcher();
    const isRerequesting = rerequestFetcher.state !== 'idle';

    const inlineFeedback = useMusicSubmissionFeedback({ fetcher: rerequestFetcher });

    const toggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    const handleRerequest = useCallback(() => {
        const formData = new FormData();
        formData.append('url', watchUrl(item.id));
        rerequestFetcher.submit(formData, {
            action: '/api/music/add',
            method: 'post',
        });
    }, [item.id, rerequestFetcher]);

    const mergedRowClass = cn(
        className ?? 'min-h-14 sm:h-14',
        'border-b border-border/30 hover:bg-accent/50 hover:border-border transition-colors',
    );

    return (
        <>
            <Table.Row
                as={motion.tr}
                className={mergedRowClass}
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                layout
            >
                <Table.Cell className='text-center py-3 sm:py-2 pl-2 sm:pl-4'>
                    <p className='font-bold text-sm sm:text-base'>{index + 1}</p>
                </Table.Cell>
                <Table.Cell className='min-w-0 py-3 sm:py-2'>
                    <MusicTitleWithHover
                        videoId={item.id}
                        title={item.title}
                        className='font-semibold text-sm sm:text-base line-clamp-2'
                        singleLine={false}
                    />
                </Table.Cell>
                <Table.Cell className='py-2 w-12 sm:w-16 pr-2 sm:pr-4'>
                    <div className='flex items-center justify-center gap-0.5 sm:gap-1'>
                        <Button
                            variant='ghost'
                            size='icon'
                            onClick={toggleExpanded}
                            aria-label={isExpanded ? '詳細を閉じる' : '詳細を開く'}
                            className='h-10 w-10 sm:h-8 sm:w-8 touch-target'
                        >
                            <ChevronDown
                                className={cn(
                                    'transition-transform duration-200',
                                    isExpanded && 'rotate-180',
                                )}
                                size={18}
                            />
                        </Button>
                    </div>
                </Table.Cell>
            </Table.Row>
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <Table.Row
                        as={motion.tr}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className='border-b border-border/30'
                    >
                        <Table.Cell colSpan={3} className='bg-muted/30 py-3 sm:py-3'>
                            <div className='flex flex-col gap-2 sm:gap-2 text-xs sm:text-sm px-2 sm:px-2'>
                                <div className='flex items-start sm:items-center gap-2'>
                                    <div className='w-20 sm:w-24 shrink-0 flex items-center justify-between'>
                                        <span className='text-muted-foreground font-medium text-left truncate text-xs sm:text-sm'>
                                            チャンネル
                                        </span>
                                        <span className='text-muted-foreground font-medium text-right'>
                                            :
                                        </span>
                                    </div>
                                    <span className='inline-flex items-center gap-1 wrap-break-word text-xs sm:text-sm'>
                                        <Radio className='h-3.5 w-3.5' />
                                        {item.channelName}
                                    </span>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <div className='w-20 sm:w-24 shrink-0 flex items-center justify-between'>
                                        <span className='text-muted-foreground font-medium text-left truncate text-xs sm:text-sm'>
                                            再生回数
                                        </span>
                                        <span className='text-muted-foreground font-medium text-right'>
                                            :
                                        </span>
                                    </div>
                                    <span className='inline-flex items-center gap-1 text-xs sm:text-sm'>
                                        <Repeat2 className='h-3.5 w-3.5' />
                                        {item.playCount}回
                                    </span>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <div className='w-20 sm:w-24 shrink-0 flex items-center justify-between'>
                                        <span className='text-muted-foreground font-medium text-left truncate text-xs sm:text-sm'>
                                            最終再生日時
                                        </span>
                                        <span className='text-muted-foreground font-medium text-right'>
                                            :
                                        </span>
                                    </div>
                                    <span className='inline-flex items-center gap-1 text-xs sm:text-sm'>
                                        <Clock3 className='h-3.5 w-3.5' />
                                        {formatDate(item.lastPlayedAt)}
                                    </span>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <div className='w-20 sm:w-24 shrink-0 flex items-center justify-between'>
                                        <span className='text-muted-foreground font-medium text-left truncate text-xs sm:text-sm'>
                                            動画ID
                                        </span>
                                        <span className='text-muted-foreground font-medium text-right'>
                                            :
                                        </span>
                                    </div>
                                    <MusicTitleWithHover
                                        videoId={item.id}
                                        title={item.id}
                                        className='inline-flex! w-auto! items-center rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[11px] text-foreground!'
                                    />
                                </div>
                                <div className='pt-2'>
                                    <Button
                                        type='button'
                                        onClick={handleRerequest}
                                        disabled={isRerequesting}
                                        className='h-10 w-full sm:w-auto rounded-xl'
                                    >
                                        {isRerequesting
                                            ? <Loader className='h-4 w-4 animate-spin' />
                                            : 'この曲を再リクエスト'}
                                    </Button>
                                    {inlineFeedback && (
                                        <p
                                            className={cn(
                                                'pt-2 text-xs sm:text-sm font-medium',
                                                inlineFeedback.tone === 'success'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-destructive',
                                            )}
                                        >
                                            {inlineFeedback.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Table.Cell>
                    </Table.Row>
                )}
            </AnimatePresence>
        </>
    );
}

export const MemoizedHistoryTableRow = memo(HistoryTableRow);
