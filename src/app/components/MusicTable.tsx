import type { Music } from '@/shared/stores/musicStore';
import { Table } from '@shadcn/ui/table';
import { AnimatePresence } from 'framer-motion';
import { memo } from 'react';
import { MemoizedMusicTableRow } from './MusicTableRow';

export interface MusicTableProps {
    musics: Music[];
    userHash?: string;
    isAdmin: boolean;
    isDeleting: boolean;
    onDelete: (id: string, asAdmin?: boolean) => void;
}

function MusicTableInner({
    musics,
    userHash,
    isAdmin,
    isDeleting,
    onDelete,
}: MusicTableProps) {
    return (
        <Table className='overflow-hidden my-4 sm:my-6 table-fixed'>
            <Table.Header>
                <Table.Row>
                    <Table.Head className='w-10 sm:w-12 text-center text-xs sm:text-sm'>
                        No.
                    </Table.Head>
                    <Table.Head className='text-sm sm:text-base'>楽曲名</Table.Head>
                    <Table.Head className='w-20 sm:w-24 text-right'>
                        <span className='sr-only'>操作</span>
                    </Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                <AnimatePresence initial={false}>
                    {musics.length > 0
                        ? (
                            musics.map((music, i) => (
                                <MemoizedMusicTableRow
                                    key={music.id}
                                    music={music}
                                    index={i}
                                    userHash={userHash}
                                    isAdmin={isAdmin}
                                    isDeleting={isDeleting}
                                    onDelete={onDelete}
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
            </Table.Body>
        </Table>
    );
}

export const MusicTable = memo(MusicTableInner);
