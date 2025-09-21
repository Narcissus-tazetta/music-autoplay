import * as React from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "./index";
import type { Music } from "~/stores/musicStore";
import { cn } from "@/app/libs/utils";
import { watchUrl } from "@/shared/libs/youtube";

type MusicWithThumbnail = Music & { thumbnail?: string };

interface MusicTitleWithHoverProps {
    music: MusicWithThumbnail;
    className?: string;
}

const CHANNEL_LINK_CLASS =
    "text-blue-500 dark:text-purple-400 hover:underline block truncate max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px]";

function MusicTitleWithHoverInner({ music, className }: MusicTitleWithHoverProps) {
    const merged = cn(CHANNEL_LINK_CLASS, className ?? "");
    const makeCandidates = (m: MusicWithThumbnail) => {
        const candidates: string[] = [];
        if (m.thumbnail) candidates.push(m.thumbnail);
        candidates.push(`https://i.ytimg.com/vi/${m.id}/maxresdefault.jpg`);
        candidates.push(`https://i.ytimg.com/vi/${m.id}/sddefault.jpg`);
        candidates.push(`https://i.ytimg.com/vi/${m.id}/hqdefault.jpg`);
        candidates.push(`https://i.ytimg.com/vi/${m.id}/mqdefault.jpg`);
        candidates.push(`https://i.ytimg.com/vi/${m.id}/default.jpg`);
        return candidates;
    };

    const candidatesRef = React.useRef<string[]>(makeCandidates(music));
    const [index, setIndex] = React.useState(0);
    const [src, setSrc] = React.useState<string>(candidatesRef.current[0] ?? "/favicon.svg");
    React.useEffect(() => {
        const next = makeCandidates(music);
        candidatesRef.current = next;
        setIndex(0);
        setSrc(next[0] ?? "/favicon.svg");
    }, [music]);

    const handleError = React.useCallback(() => {
        const nextIndex = index + 1;
        const next = candidatesRef.current[nextIndex];
        if (next) {
            setIndex(nextIndex);
            setSrc(next);
        } else {
            setSrc("/favicon.svg");
        }
    }, [index]);

    return (
        <HoverCard>
            <HoverCardTrigger
                href={watchUrl(music.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={merged}
                title={music.title}
            >
                {music.title}
            </HoverCardTrigger>
            <HoverCardContent>
                <img
                    key={`${music.id}-thumb-${index}`}
                    src={src}
                    alt={`${music.title} のサムネイル`}
                    className="w-full h-auto rounded"
                    onError={handleError}
                    loading="lazy"
                />
            </HoverCardContent>
        </HoverCard>
    );
}

export const MusicTitleWithHover = React.memo(MusicTitleWithHoverInner);
