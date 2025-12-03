import { useMusicRow } from '@/app/hooks/useMusicRow';
import { cn } from '@/app/utils/cn';
import { MusicTitleWithHover } from '@/shared/components';
import type { Music } from '@/shared/stores/musicStore';
import { formatDuration, formatRequestedAt } from '@/shared/utils/format';
import { channelUrl } from '@/shared/utils/youtube';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Loader, MoreVertical, TrashIcon } from 'lucide-react';
import { memo } from 'react';
import { Button } from '~/components/ui/shadcn/button';
import { Table } from '~/components/ui/shadcn/table';

export interface MusicTableRowProps {
    music: Music;
    index: number;
    userHash?: string;
    isAdmin: boolean;
    isDeleting?: boolean;
    onDelete: (id: string, isAdmin?: boolean) => void;
    className?: string;
}

const CHANNEL_LINK_CLASS = 'text-blue-500 dark:text-purple-400 hover:underline inline-block';

const getRequesterDisplayName = (requesterName?: string): string => {
    if (!requesterName) return 'unknown';
    if (requesterName === 'guest') return 'guest';
    return requesterName;
};

export default function MusicTableRow({
    music,
    index,
    userHash,
    isAdmin,
    isDeleting = false,
    onDelete,
    className,
}: MusicTableRowProps) {
    const { isExpanded, canDelete, handleDelete, toggleExpanded } = useMusicRow({
        musicId: music.id,
        requesterHash: music.requesterHash,
        userHash,
        isAdmin,
        onDelete,
    });

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
                <Table.Cell className='text-center py-3 sm:py-2'>
                    <p className='font-bold text-sm sm:text-base'>{index + 1}</p>
                </Table.Cell>
                <Table.Cell className='min-w-0 py-3 sm:py-2'>
                    <MusicTitleWithHover music={music} />
                </Table.Cell>
                <Table.Cell className='py-2'>
                    <div className='flex items-center justify-end gap-0.5 sm:gap-1'>
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
                        {canDelete && (
                            <Button
                                variant='ghost'
                                size='icon'
                                className='text-destructive hover:text-destructive/80 h-10 w-10 sm:h-8 sm:w-8 touch-target'
                                disabled={isDeleting}
                                onClick={handleDelete}
                                aria-label={`delete ${music.title}`}
                            >
                                {isDeleting ? <Loader className='animate-spin' size={18} /> : <TrashIcon size={18} />}
                            </Button>
                        )}
                        {!canDelete && (
                            <Button
                                variant='ghost'
                                size='icon'
                                className='h-10 w-10 sm:h-8 sm:w-8 invisible'
                                disabled
                                aria-hidden
                            >
                                <MoreVertical size={18} />
                            </Button>
                        )}
                    </div>
                </Table.Cell>
            </Table.Row>
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <Table.Row
                        as={motion.tr}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className='border-b border-border/30'
                    >
                        <Table.Cell colSpan={3} className='bg-muted/30 py-3 sm:py-3'>
                            <div className='flex flex-col gap-2 sm:gap-2 text-xs sm:text-sm px-2 sm:px-2'>
                                <div className='flex items-start sm:items-center gap-2'>
                                    <div className='w-20 sm:w-24 flex-shrink-0 flex items-center justify-between'>
                                        <span className='text-muted-foreground font-medium text-left truncate text-xs sm:text-sm'>
                                            チャンネル
                                        </span>
                                        <span className='text-muted-foreground font-medium text-right'>
                                            :
                                        </span>
                                    </div>
                                    <a
                                        className={CHANNEL_LINK_CLASS + ' break-all text-xs sm:text-sm'}
                                        href={channelUrl(music.channelId)}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                    >
                                        {music.channelName}
                                    </a>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <div className='w-20 sm:w-24 flex-shrink-0 flex items-center justify-between'>
                                        <span className='text-muted-foreground font-medium text-left truncate text-xs sm:text-sm'>
                                            再生時間
                                        </span>
                                        <span className='text-muted-foreground font-medium text-right'>
                                            :
                                        </span>
                                    </div>
                                    <span className='text-xs sm:text-sm'>
                                        {formatDuration(music.duration)}
                                    </span>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <div className='w-20 sm:w-24 flex-shrink-0 flex items-center justify-between'>
                                        <span className='text-muted-foreground font-medium text-left truncate text-xs sm:text-sm'>
                                            リクエスト
                                        </span>
                                        <span className='text-muted-foreground font-medium text-right'>
                                            :
                                        </span>
                                    </div>
                                    <span className='text-xs sm:text-sm'>
                                        {formatRequestedAt(music.requestedAt)}
                                    </span>
                                </div>
                                <div className='flex items-center gap-2'>
                                    <div className='w-20 sm:w-24 flex-shrink-0 flex items-center justify-between'>
                                        <span className='text-muted-foreground font-medium text-left truncate text-xs sm:text-sm'>
                                            リクエスター
                                        </span>
                                        <span className='text-muted-foreground font-medium text-right'>
                                            :
                                        </span>
                                    </div>
                                    <span className='font-medium text-xs sm:text-sm'>
                                        {getRequesterDisplayName(music.requesterName)}
                                    </span>
                                </div>
                            </div>
                        </Table.Cell>
                    </Table.Row>
                )}
            </AnimatePresence>
        </>
    );
}

export const MemoizedMusicTableRow = memo(MusicTableRow);
