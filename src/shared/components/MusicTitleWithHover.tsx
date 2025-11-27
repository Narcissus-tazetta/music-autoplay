import { cn } from "@/app/utils/cn";
import type { Music } from "@/shared/stores/musicStore";
import { watchUrl } from "@/shared/utils/youtube";
import { memo, useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./index";

type MusicWithThumbnail = Music & { thumbnail?: string };

interface MusicTitleWithHoverProps {
  music?: MusicWithThumbnail;
  videoId?: string;
  title?: string;
  href?: string;
  className?: string;
}

const CHANNEL_LINK_CLASS =
  "text-blue-500 dark:text-purple-400 hover:underline block truncate w-full";

const makeCandidates = (videoId: string, thumbnail?: string): string[] => {
  const candidates: string[] = [];
  if (thumbnail) candidates.push(thumbnail);
  candidates.push(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
  candidates.push(`https://i.ytimg.com/vi/${videoId}/sddefault.jpg`);
  candidates.push(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
  candidates.push(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`);
  candidates.push(`https://i.ytimg.com/vi/${videoId}/default.jpg`);
  return candidates;
};

function MusicTitleWithHoverInner({
  music,
  videoId: externalVideoId,
  title: externalTitle,
  href: externalHref,
  className,
}: MusicTitleWithHoverProps) {
  const videoId = music?.id ?? externalVideoId ?? "";
  const title = music?.title ?? externalTitle ?? "";
  const href = externalHref ?? (music ? watchUrl(music.id) : undefined);

  const [failedIndices, setFailedIndices] = useState<{
    id: string;
    indices: Set<number>;
  }>({
    id: videoId,
    indices: new Set(),
  });

  if (!videoId || !title) return null;

  const merged = cn(CHANNEL_LINK_CLASS, className ?? "");
  const candidates = makeCandidates(videoId, music?.thumbnail);

  const activeIndices =
    failedIndices.id === videoId ? failedIndices.indices : new Set<number>();
  const currentSrc = (() => {
    const firstValidIndex = candidates.findIndex(
      (_, i) => !activeIndices.has(i),
    );
    return firstValidIndex >= 0 ? candidates[firstValidIndex] : "/favicon.svg";
  })();

  const handleError = () => {
    const currentIndex = candidates.indexOf(currentSrc);
    if (currentIndex >= 0) {
      setFailedIndices((prev) => ({
        id: videoId,
        indices:
          prev.id === videoId
            ? new Set([...prev.indices, currentIndex])
            : new Set([currentIndex]),
      }));
    }
  };

  return (
    <HoverCard>
      <HoverCardTrigger
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(merged, "text-sm sm:text-base")}
        title={title}
      >
        {title}
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-2">
        <img
          key={`${videoId}-${currentSrc}`}
          src={currentSrc}
          alt={`${title} のサムネイル`}
          className="w-full h-auto rounded"
          onError={handleError}
          loading="lazy"
        />
      </HoverCardContent>
    </HoverCard>
  );
}

export const MusicTitleWithHover = memo(MusicTitleWithHoverInner);
