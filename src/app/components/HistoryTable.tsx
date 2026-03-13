import { cn } from '@/app/utils/cn';
import type { HistoryItem } from '@/shared/types/history';
import { Table } from '@shadcn/ui/table';
import { AnimatePresence } from 'framer-motion';
import {
    ArrowDownWideNarrow,
    ArrowUpNarrowWide,
    CheckIcon,
    Flame,
    History as HistoryIcon,
    ListFilter,
} from 'lucide-react';
import { memo } from 'react';
import { Button } from '~/components/ui/shadcn/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '~/components/ui/shadcn/dropdown-menu';
import { MemoizedHistoryTableRow } from './HistoryTableRow';

export interface HistoryTableProps {
    items: HistoryItem[];
    sort: import('@/shared/types/history').HistorySort;
    setSort: (value: import('@/shared/types/history').HistorySort) => void;
}

function HistoryTableInner({ items, sort, setSort }: HistoryTableProps) {
    const selectedSortColorClass = 'text-blue-500 dark:text-purple-400';

    return (
        <Table className='overflow-hidden table-fixed'>
            <Table.Header>
                <Table.Row>
                    <Table.Head className='w-10 sm:w-12 text-center text-xs sm:text-sm pl-2 sm:pl-4'>
                        No.
                    </Table.Head>
                    <Table.Head className='text-sm sm:text-base'>楽曲名</Table.Head>
                    <Table.Head className='w-12 sm:w-16 text-center pr-2 sm:pr-4'>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant='ghost'
                                    size='icon'
                                    aria-label='表示順メニュー'
                                    className='h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-foreground transition-colors'
                                >
                                    <ListFilter className='h-4 w-4' />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end' className='w-48 rounded-xl shadow-lg'>
                                <DropdownMenuLabel className='text-xs font-semibold text-muted-foreground'>
                                    並び替え
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setSort('newest')}
                                    className='cursor-pointer py-2 rounded-md'
                                >
                                    <div className='flex items-center gap-2 w-full'>
                                        <ArrowDownWideNarrow
                                            className={cn(
                                                'h-4 w-4',
                                                selectedSortColorClass,
                                            )}
                                        />
                                        <span className={cn('flex-1', sort === 'newest' && 'font-medium')}>
                                            新しい順
                                        </span>
                                        {sort === 'newest' && (
                                            <CheckIcon className={cn('h-4 w-4', selectedSortColorClass)} />
                                        )}
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setSort('oldest')}
                                    className='cursor-pointer py-2 rounded-md'
                                >
                                    <div className='flex items-center gap-2 w-full'>
                                        <ArrowUpNarrowWide
                                            className={cn(
                                                'h-4 w-4',
                                                selectedSortColorClass,
                                            )}
                                        />
                                        <span className={cn('flex-1', sort === 'oldest' && 'font-medium')}>
                                            古い順
                                        </span>
                                        {sort === 'oldest' && (
                                            <CheckIcon className={cn('h-4 w-4', selectedSortColorClass)} />
                                        )}
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setSort('mostPlayed')}
                                    className='cursor-pointer py-2 rounded-md'
                                >
                                    <div className='flex items-center gap-2 w-full'>
                                        <Flame
                                            className={cn(
                                                'h-4 w-4',
                                                selectedSortColorClass,
                                            )}
                                        />
                                        <span
                                            className={cn(
                                                'flex-1',
                                                sort === 'mostPlayed' && 'font-medium',
                                            )}
                                        >
                                            再生回数順
                                        </span>
                                        {sort === 'mostPlayed' && (
                                            <CheckIcon className={cn('h-4 w-4', selectedSortColorClass)} />
                                        )}
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                <AnimatePresence initial={false}>
                    {items.length > 0
                        ? (
                            items.map((item, index) => (
                                <MemoizedHistoryTableRow
                                    key={item.id}
                                    item={item}
                                    index={index}
                                />
                            ))
                        )
                        : (
                            <Table.Row>
                                <Table.Cell colSpan={3} className='py-8 sm:py-12'>
                                    <div className='flex flex-col items-center gap-3 text-center'>
                                        <div className='flex h-12 w-12 items-center justify-center rounded-full border border-border/40 bg-muted/20'>
                                            <HistoryIcon className='h-5 w-5 text-muted-foreground' />
                                        </div>
                                        <div className='space-y-1'>
                                            <p className='text-sm sm:text-base font-medium'>履歴はまだありません</p>
                                            <p className='text-xs sm:text-sm text-muted-foreground'>
                                                動画の再生完了後にここへ追加されます
                                            </p>
                                        </div>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        )}
                </AnimatePresence>
            </Table.Body>
        </Table>
    );
}

export const HistoryTable = memo(HistoryTableInner);
