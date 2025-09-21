import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "~/components/ui/shadcn/button";
import { Table } from "~/components/ui/shadcn/table";
import { Loader, TrashIcon } from "lucide-react";
import { MusicTitleWithHover } from "@/shared/components";
import { channelUrl } from "@/shared/libs/youtube";
import { cn } from "@/app/libs/utils";
import type { Music } from "~/stores/musicStore";

export interface MusicTableRowProps {
    music: Music;
    index: number;
    userHash?: string;
    isAdmin: boolean;
    isDeleting?: boolean;
    onDelete: (id: string, isAdmin?: boolean) => void;
    className?: string;
}

const CHANNEL_LINK_CLASS =
    "text-blue-500 dark:text-purple-400 hover:underline block truncate max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px]";

export default function MusicTableRow({
    music,
    index,
    userHash,
    isAdmin,
    isDeleting = false,
    onDelete,
    className,
}: MusicTableRowProps) {
    const canDelete = Boolean(isAdmin) || (Boolean(music.requesterHash) && userHash === music.requesterHash);

    const handleDelete = React.useCallback(() => {
        onDelete(music.id, isAdmin);
    }, [onDelete, music.id, isAdmin]);

    const mergedRowClass = cn(className ?? "h-14");

    return (
        <Table.Row
            as={motion.tr}
            className={mergedRowClass}
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            layout
        >
            <Table.Cell className="text-center">
                <p className="font-bold">{index + 1}</p>
            </Table.Cell>
            <Table.Cell>
                <MusicTitleWithHover music={music} />
            </Table.Cell>

            {canDelete ? (
                <>
                    <Table.Cell>
                        <a
                            className={CHANNEL_LINK_CLASS}
                            href={channelUrl(music.channelId)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {music.channelName}
                        </a>
                    </Table.Cell>
                    <Table.Cell>
                        <div className="flex items-center justify-center px-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600"
                                disabled={isDeleting}
                                onClick={handleDelete}
                                aria-label={`delete ${music.title}`}
                            >
                                {isDeleting ? <Loader className="animate-spin" /> : <TrashIcon />}
                            </Button>
                        </div>
                    </Table.Cell>
                </>
            ) : (
                <Table.Cell colSpan={2}>
                    <a
                        className={CHANNEL_LINK_CLASS}
                        href={channelUrl(music.channelId)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {music.channelName}
                    </a>
                </Table.Cell>
            )}
        </Table.Row>
    );
}

export const MemoizedMusicTableRow = React.memo(MusicTableRow);
