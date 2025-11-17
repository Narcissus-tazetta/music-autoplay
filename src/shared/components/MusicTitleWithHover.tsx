import { cn } from "@/app/utils/cn";
import type { Music } from "@/shared/stores/musicStore";
import { watchUrl } from "@/shared/utils/youtube";
import { memo, useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./index";

type MusicWithThumbnail = Music & { thumbnail?: string };

interface MusicTitleWithHoverProps {
  music: MusicWithThumbnail;
  className?: string;
}

const CHANNEL_LINK_CLASS =
  "text-blue-500 dark:text-purple-400 hover:underline block truncate w-full";

const makeCandidates = (m: MusicWithThumbnail): string[] => {
  const candidates: string[] = [];
  if (m.thumbnail) candidates.push(m.thumbnail);
  candidates.push(`https://i.ytimg.com/vi/${m.id}/maxresdefault.jpg`);
  candidates.push(`https://i.ytimg.com/vi/${m.id}/sddefault.jpg`);
  candidates.push(`https://i.ytimg.com/vi/${m.id}/hqdefault.jpg`);
  candidates.push(`https://i.ytimg.com/vi/${m.id}/mqdefault.jpg`);
  candidates.push(`https://i.ytimg.com/vi/${m.id}/default.jpg`);
  return candidates;
};

function MusicTitleWithHoverInner({
  music,
  className,
}: MusicTitleWithHoverProps) {
  const merged = cn(CHANNEL_LINK_CLASS, className ?? "");
  const candidates = makeCandidates(music);
  const [failedIndices, setFailedIndices] = useState<{
    id: string;
    indices: Set<number>;
  }>({
    id: music.id,
    indices: new Set(),
  });

  const activeIndices =
    failedIndices.id === music.id ? failedIndices.indices : new Set<number>();
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
        id: music.id,
        indices:
          prev.id === music.id
            ? new Set([...prev.indices, currentIndex])
            : new Set([currentIndex]),
      }));
    }
  };

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
          key={`${music.id}-${currentSrc}`}
          src={currentSrc}
          alt={`${music.title} のサムネイル`}
          className="w-full h-auto rounded"
          onError={handleError}
          loading="lazy"
        />
      </HoverCardContent>
    </HoverCard>
  );
}

export const MusicTitleWithHover = memo(MusicTitleWithHoverInner);
