import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RemoteStatus, Music } from "~/stores/musicStore";
import { searchUrl } from "@/shared/libs/youtube";
import { useSettingsStore } from "../stores/settingsStore";
import { MusicTitleWithHover } from "./MusicTitleWithHover";

interface StatusBadgeProps {
    status: RemoteStatus;
    music?: Music;
    title?: string;
}

function StatusBadgeInner({ status, music }: StatusBadgeProps) {
    const dotClass =
        status.type === "playing" ? "bg-emerald-600" : status.type === "paused" ? "bg-orange-600" : "bg-gray-500";
    const badgeBg = "bg-gray-100 dark:bg-gray-900/10";
    const [closedVisible, setClosedVisible] = React.useState(true);
    const [badgeVisible, setBadgeVisible] = React.useState(true);
    const timerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (status.type === "closed") {
            setClosedVisible(true);
            setBadgeVisible(true);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = window.setTimeout(() => {
                setClosedVisible(false);
                setBadgeVisible(false);
                timerRef.current = null;
            }, 30_000);
        } else {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            setClosedVisible(true);
            setBadgeVisible(true);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [status.type]);

    const ytStatusVisible = useSettingsStore((s) => s.ytStatusVisible);
    if (!ytStatusVisible) return null;
    if (!badgeVisible) return null;

    return (
        <div aria-live="polite" className={`${badgeBg} text-sm px-3 py-1 rounded-md flex items-center gap-3`}>
            {status.type === "closed" ? (
                <AnimatePresence>
                    {closedVisible && (
                        <motion.span
                            key="dot"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className={`inline-block w-3 h-3 rounded-full ${dotClass}`}
                            aria-hidden
                        />
                    )}
                </AnimatePresence>
            ) : (
                <span className={`inline-block w-3 h-3 rounded-full ${dotClass}`} aria-hidden />
            )}
            {status.type === "playing" ? (
                music ? (
                    <span className="inline-flex items-center justify-center gap-2 text-center">
                        <span className="text-gray-800 dark:text-gray-100 font-medium whitespace-nowrap">再生中:</span>
                        <MusicTitleWithHover
                            music={music}
                            className="text-gray-800 dark:text-gray-100 font-medium hover:underline break-words"
                        />
                    </span>
                ) : (
                    // status is a discriminated union; narrow for playing
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

                        return <span className="text-gray-800 dark:text-gray-100 font-medium">再生中</span>;
                    })()
                )
            ) : status.type === "paused" ? (
                <span className="text-gray-800 dark:text-gray-100">一時停止中</span>
            ) : (
                <AnimatePresence>
                    {closedVisible && (
                        <motion.span
                            key="closed-msg"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6 }}
                            className="text-gray-800 dark:text-gray-100"
                        >
                            タブが閉じられました
                        </motion.span>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}

export const StatusBadge = React.memo(StatusBadgeInner);
