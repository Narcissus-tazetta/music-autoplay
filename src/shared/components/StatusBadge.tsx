import type { Music, RemoteStatus } from "@/shared/stores/musicStore";
import { searchUrl } from "@/shared/utils/youtube";
import { motion } from "framer-motion";
import { memo, useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { MusicTitleWithHover } from "./MusicTitleWithHover";

interface StatusBadgeProps {
  status: RemoteStatus | null;
  music?: Music;
  title?: string;
}

type VisibilityState = "visible" | "hiding" | "hidden";

function StatusBadgeInner({ status, music }: StatusBadgeProps) {
  const [visibility, setVisibility] = useState<VisibilityState>("visible");
  const timerRef = useRef<number | null>(null);
  const settings = useSettingsStore();
  const ytStatusVisible = settings.ytStatusVisible;

  const dotClass =
    status?.type === "playing"
      ? "bg-emerald-600"
      : status?.type === "paused"
        ? "bg-orange-600"
        : "bg-gray-500";
  const badgeBg = "bg-gray-100 dark:bg-gray-900/10";

  useEffect(() => {
    if (!status) {
      setVisibility("hidden");
      return;
    }

    if (status.type === "closed") {
      setVisibility("visible");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setVisibility("hiding");
        timerRef.current = window.setTimeout(() => {
          setVisibility("hidden");
          timerRef.current = null;
        }, 600);
      }, 30_000);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisibility("visible");
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  if (!status || !ytStatusVisible || visibility === "hidden") return null;

  return (
    <motion.div
      aria-live="polite"
      className={`${badgeBg} text-sm px-3 py-1 rounded-md flex items-center gap-3`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      {visibility === "visible" && (
        <span
          className={`inline-block w-3 h-3 rounded-full ${dotClass}`}
          aria-hidden
        />
      )}
      {status.type === "playing" ? (
        music ? (
          <span className="inline-flex items-center justify-center gap-2 text-center">
            <span className="text-gray-800 dark:text-gray-100 font-medium whitespace-nowrap">
              再生中:
            </span>
            <MusicTitleWithHover
              music={music}
              className="text-gray-800 dark:text-gray-100 font-medium hover:underline break-words"
            />
          </span>
        ) : (
          ((): React.ReactElement => {
            const musicTitle = status.musicTitle;
            if (typeof musicTitle === "string" && musicTitle.length > 0) {
              return (
                <span className="inline-flex items-center justify-center gap-2 text-center">
                  <span className="text-gray-800 dark:text-gray-100 font-medium whitespace-nowrap">
                    再生中:
                  </span>
                  <a
                    href={searchUrl(musicTitle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-800 dark:text-gray-100 font-medium hover:underline break-words"
                    title={musicTitle}
                  >
                    {musicTitle}
                  </a>
                </span>
              );
            }
            return (
              <span className="text-gray-800 dark:text-gray-100 font-medium">
                再生中
              </span>
            );
          })()
        )
      ) : status.type === "paused" ? (
        <span className="text-gray-800 dark:text-gray-100">一時停止中</span>
      ) : (
        visibility === "visible" && (
          <span className="text-gray-800 dark:text-gray-100">
            タブが閉じられました
          </span>
        )
      )}
    </motion.div>
  );
}

export const StatusBadge = memo(StatusBadgeInner);
