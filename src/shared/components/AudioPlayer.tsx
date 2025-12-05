import { cn } from "@/app/utils/cn";
import {
  useInterpolatedTime,
  useThumbnail,
  useVisibilityTimer,
} from "@/shared/hooks/usePlayerState";
import type { Music, RemoteStatus } from "@/shared/stores/musicStore";
import { formatSecondsToTime } from "@/shared/utils/format";
import { watchUrl } from "@/shared/utils/youtube";
import { motion } from "framer-motion";
import { memo, useMemo } from "react";
import type { ReactElement } from "react";
import { MusicTitleWithHover } from "./MusicTitleWithHover";

interface AudioPlayerProps {
  status: RemoteStatus | null;
  music?: Music;
}

function AudioPlayerInner({
  status,
  music,
}: AudioPlayerProps): ReactElement | null {
  const videoId =
    (status?.type === "playing" && (status.musicId || status.videoId)) ||
    (status?.type === "paused" && status.musicId) ||
    music?.id ||
    "";

  const title =
    (status?.type === "playing" && status.musicTitle) ||
    (status?.type === "paused" && status.musicTitle) ||
    music?.title ||
    "";

  const duration = useMemo((): number | undefined => {
    if (status?.type === "playing" && typeof status.duration === "number")
      return status.duration;
    if (music?.duration) {
      const parts = music.duration.split(":").map((p) => parseInt(p, 10));
      if (parts.every((p) => !isNaN(p))) {
        if (parts.length === 3)
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
      }
    }
    return undefined;
  }, [status, music?.duration]);

  const { currentTime: localCurrentTime, isEffectivelyPaused } =
    useInterpolatedTime({ status, duration });
  const visibility = useVisibilityTimer({
    hasStatus: !!status,
    isClosed: status?.type === "closed",
  });
  const thumbnail = useThumbnail(videoId);

  const isAdvertisement =
    status?.type === "playing" && status.isAdvertisement === true;
  const isExternalVideo =
    status?.type === "playing" && status.isExternalVideo === true;
  const isPaused = status?.type === "paused";
  const pausedIndicator = isPaused || isEffectivelyPaused;

  const progressBarColor = useMemo(
    () =>
      isAdvertisement
        ? "bg-yellow-500"
        : isExternalVideo
          ? "bg-purple-500"
          : pausedIndicator
            ? "bg-orange-600"
            : "bg-emerald-600",
    [isAdvertisement, isExternalVideo, pausedIndicator],
  );

  if (!status || visibility === "hidden") return null;

  const progressPercent =
    duration != null && duration > 0
      ? Math.min((localCurrentTime / duration) * 100, 100)
      : 0;

  const href = videoId ? watchUrl(videoId) : undefined;

  return (
    <motion.div
      aria-live="polite"
      className="bg-gray-100 dark:bg-gray-900/10 rounded-lg p-3 sm:p-4 flex flex-row items-center gap-3 sm:gap-4 max-w-full shadow-sm"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: visibility === "visible" ? 1 : 0, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative w-16 sm:w-20 md:w-24 aspect-video shrink-0 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-800"
      >
        {!thumbnail.loaded && (
          <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700 animate-pulse" />
        )}
        <img
          key={`${videoId}-${thumbnail.src}`}
          src={thumbnail.src}
          alt={`${title} のサムネイル`}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200",
            thumbnail.loaded ? "opacity-100" : "opacity-0",
          )}
          onError={thumbnail.handleError}
          onLoad={thumbnail.handleLoad}
          loading="lazy"
        />
      </a>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2">
        <div className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-100">
          {videoId && title ? (
            <MusicTitleWithHover
              music={music}
              videoId={videoId}
              title={title}
              href={href}
              className="text-gray-800 dark:text-gray-100 font-medium hover:underline line-clamp-1 sm:line-clamp-2 text-sm sm:text-base"
            />
          ) : (
            <span className="line-clamp-1 sm:line-clamp-2">
              {title || "再生中"}
            </span>
          )}
        </div>

        <div className="w-full">
          <div className="relative w-full h-1 sm:h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute left-0 top-0 h-full rounded-full transition-all duration-100 ease-linear",
                progressBarColor,
              )}
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {duration != null && (
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex justify-between items-center">
            <span
              className={
                isAdvertisement
                  ? "text-yellow-400"
                  : pausedIndicator
                    ? "text-orange-400"
                    : "text-slate-400"
              }
            >
              {formatSecondsToTime(localCurrentTime)}
            </span>
            <span
              className={
                isAdvertisement
                  ? "text-yellow-400"
                  : pausedIndicator
                    ? "text-orange-400"
                    : "text-slate-400"
              }
            >
              {formatSecondsToTime(duration)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const AudioPlayer = memo(AudioPlayerInner);
