import { INSERT_AT_FRONT } from '@/shared/schemas/music';
import type { Music } from '@/shared/stores/musicStore';
import { Table } from '@shadcn/ui/table';
import { AnimatePresence, Reorder } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { MemoizedMusicTableRow } from './MusicTableRow';
import type { RequesterSelection } from './RequesterDetailDialog';

export interface MusicTableProps {
    musics: Music[];
    userHash?: string;
    isAdmin: boolean;
    /** Enables drag/keyboard reordering of the viewer's own rows (all rows for admins). */
    canReorder?: boolean;
    isDeleting: boolean;
    onDelete: (id: string, asAdmin?: boolean) => void;
    /** Requests moving `id` directly after `afterId` (INSERT_AT_FRONT = to the front). */
    onReorder?: (id: string, afterId: string) => void;
    onRequesterClick?: (requester: RequesterSelection) => void;
    headerAction?: React.ReactNode;
    /** Bump this after a rejected/failed reorder to force-resync the optimistic order back to `musics`. */
    reorderResyncToken?: number;
}

function MusicTableInner({
    musics,
    userHash,
    isAdmin,
    canReorder = false,
    isDeleting,
    onDelete,
    onReorder,
    onRequesterClick,
    headerAction,
    reorderResyncToken = 0,
}: MusicTableProps) {
    const hasAnyDeletableRow = isAdmin || (!!userHash && musics.some(music => music.requesterHash === userHash));
    const actionColumnClass = hasAnyDeletableRow
        ? 'w-24 text-right align-middle'
        : 'w-12 sm:w-16 text-right align-middle';

    const [orderedMusics, setOrderedMusics] = useState(musics);
    const orderedMusicsRef = useRef(musics);
    const isDraggingRef = useRef(false);
    const dragStartOrderRef = useRef<string[]>([]);
    const prevResyncTokenRef = useRef(reorderResyncToken);

    const applyOrder = useCallback((next: Music[]) => {
        orderedMusicsRef.current = next;
        setOrderedMusics(next);
    }, []);

    // Single sync path: adopt `musics` on every change unless a drag is in progress.
    // A bumped resync token (a rejected/failed reorder that produced no store update)
    // forces the resync even then, reverting the optimistic order.
    useEffect(() => {
        const tokenChanged = reorderResyncToken !== prevResyncTokenRef.current;
        prevResyncTokenRef.current = reorderResyncToken;
        if (!tokenChanged && isDraggingRef.current) return;
        applyOrder(musics);
    }, [applyOrder, musics, reorderResyncToken]);

    const submitReorder = useCallback((id: string) => {
        const order = orderedMusicsRef.current;
        const index = order.findIndex(m => m.id === id);
        if (index === -1) return;
        onReorder?.(id, index === 0 ? INSERT_AT_FRONT : order[index - 1].id);
    }, [onReorder]);

    const handleReorderChange = useCallback((next: Music[]) => {
        applyOrder(next);
    }, [applyOrder]);

    const handleDragStart = useCallback(() => {
        isDraggingRef.current = true;
        dragStartOrderRef.current = orderedMusicsRef.current.map(m => m.id);
    }, []);

    const handleDragEnd = useCallback((id: string) => {
        isDraggingRef.current = false;
        const order = orderedMusicsRef.current;
        const unchanged = order.length === dragStartOrderRef.current.length
            && order.every((m, i) => m.id === dragStartOrderRef.current[i]);
        if (unchanged) return;
        submitReorder(id);
    }, [submitReorder]);

    const handleKeyboardMove = useCallback((id: string, delta: -1 | 1) => {
        const order = orderedMusicsRef.current;
        const index = order.findIndex(m => m.id === id);
        const target = index + delta;
        if (index === -1 || target < 0 || target >= order.length) return;
        const next = [...order];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        applyOrder(next);
        submitReorder(id);
    }, [applyOrder, submitReorder]);

    return (
        <Table className='overflow-hidden my-4 sm:my-6 table-fixed'>
            <Table.Header>
                <Table.Row>
                    <Table.Head className='w-10 sm:w-12 text-center text-xs sm:text-sm'>
                        No.
                    </Table.Head>
                    <Table.Head className='text-sm sm:text-base'>楽曲名</Table.Head>
                    <Table.Head className={actionColumnClass}>
                        {headerAction
                            ? <div className='flex items-center justify-end gap-1'>{headerAction}</div>
                            : <span className='sr-only'>操作</span>}
                    </Table.Head>
                </Table.Row>
            </Table.Header>
            <Reorder.Group
                as='tbody'
                axis='y'
                values={orderedMusics}
                onReorder={handleReorderChange}
                data-slot='table-body'
                className='[&_tr:last-child]:border-0'
            >
                <AnimatePresence initial={false}>
                    {orderedMusics.length > 0
                        ? (
                            orderedMusics.map((music, i) => (
                                <MemoizedMusicTableRow
                                    key={music.id}
                                    music={music}
                                    index={i}
                                    userHash={userHash}
                                    isAdmin={isAdmin}
                                    isDeleting={isDeleting}
                                    onDelete={onDelete}
                                    onRequesterClick={onRequesterClick}
                                    reserveDeleteSlot={hasAnyDeletableRow}
                                    canDrag={canReorder
                                        && (isAdmin || (!!music.requesterHash && music.requesterHash === userHash))}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onKeyboardMove={handleKeyboardMove}
                                />
                            ))
                        )
                        : (
                            <Table.Row>
                                <Table.Cell colSpan={3} className='py-8 sm:py-12'>
                                    <p className='text-center text-sm sm:text-base text-muted-foreground'>
                                        リクエストされた楽曲はありません
                                    </p>
                                </Table.Cell>
                            </Table.Row>
                        )}
                </AnimatePresence>
            </Reorder.Group>
        </Table>
    );
}

export const MusicTable = memo(MusicTableInner);
