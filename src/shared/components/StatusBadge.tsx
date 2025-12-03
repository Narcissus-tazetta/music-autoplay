import type { Music, RemoteStatus } from '@/shared/stores/musicStore';
import { searchUrl } from '@/shared/utils/youtube';
import { motion } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { AudioPlayer } from './AudioPlayer';
import { MusicTitleWithHover } from './MusicTitleWithHover';

interface StatusBadgeProps {
    status: RemoteStatus | null;
    music?: Music;
    title?: string;
    mode?: 'compact' | 'player';
}

type VisibilityState = 'visible' | 'hiding' | 'hidden';

function StatusBadgeCompact({ status, music }: Omit<StatusBadgeProps, 'mode'>) {
    const [visibility, setVisibility] = useState<VisibilityState>('visible');
    const timerRef = useRef<number | null>(null);
    const settings = useSettingsStore();
    const ytStatusVisible = settings.ytStatusVisible;

    const isAdvertisement = status?.type === 'playing' && status.isAdvertisement === true;
    const isTransitioning = status?.type === 'paused' && status.isTransitioning === true;
    const isExternalVideo = status?.type === 'playing' && status.isExternalVideo === true;
    const dotClass = isAdvertisement
        ? 'bg-yellow-500'
        : isTransitioning
        ? 'bg-blue-500'
        : isExternalVideo
        ? 'bg-purple-500'
        : status?.type === 'playing'
        ? 'bg-emerald-600'
        : status?.type === 'paused'
        ? 'bg-orange-600'
        : 'bg-gray-500';
    const badgeBg = 'bg-gray-100 dark:bg-gray-900/10';

    useEffect(() => {
        if (!status) {
            setVisibility('hidden');
            return;
        }

        if (status.type === 'closed') {
            setVisibility('visible');
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
                setVisibility('hiding');
                timerRef.current = window.setTimeout(() => {
                    setVisibility('hidden');
                    timerRef.current = null;
                }, 600);
            }, 30_000);
        } else {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            setVisibility('visible');
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [status]);

    if (!status || !ytStatusVisible || visibility === 'hidden') return null;

    return (
        <motion.div
            aria-live='polite'
            className={`${badgeBg} text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-1 rounded-md flex items-center gap-2 sm:gap-3 max-w-full`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
        >
            {visibility === 'visible' && (
                <span
                    className={`inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${dotClass}`}
                    aria-hidden
                />
            )}
            {isAdvertisement
                ? <span className='text-gray-800 dark:text-gray-100 font-medium text-xs sm:text-sm'>広告再生中</span>
                : isTransitioning
                ? (
                    <span className='text-gray-800 dark:text-gray-100 font-medium text-xs sm:text-sm'>
                        次の動画に移動中...
                    </span>
                )
                : status.type === 'playing'
                ? (
                    music
                        ? (
                            <span className='inline-flex items-center justify-center gap-1.5 sm:gap-2 text-center min-w-0'>
                                <span className='text-gray-800 dark:text-gray-100 font-medium whitespace-nowrap text-xs sm:text-sm'>
                                    再生中:
                                </span>
                                <MusicTitleWithHover
                                    music={music}
                                    className='text-gray-800 dark:text-gray-100 font-medium hover:underline break-words min-w-0 text-xs sm:text-sm'
                                />
                            </span>
                        )
                        : (
                            ((): React.ReactElement => {
                                const musicTitle = status.musicTitle;
                                const textColorClass = isExternalVideo
                                    ? 'text-white'
                                    : 'text-gray-800 dark:text-gray-100';

                                if (typeof musicTitle === 'string' && musicTitle.length > 0) {
                                    const videoId = status.videoId;

                                    if (isExternalVideo && videoId) {
                                        return (
                                            <span className='inline-flex items-center justify-center gap-1.5 sm:gap-2 text-center min-w-0'>
                                                <span
                                                    className={`${textColorClass} font-medium whitespace-nowrap text-xs sm:text-sm`}
                                                >
                                                    リスト外 再生中:
                                                </span>
                                                <MusicTitleWithHover
                                                    videoId={videoId}
                                                    title={musicTitle}
                                                    href={searchUrl(musicTitle)}
                                                    className={`${textColorClass} font-medium hover:underline break-words min-w-0 text-xs sm:text-sm`}
                                                />
                                            </span>
                                        );
                                    }

                                    return (
                                        <span className='inline-flex items-center justify-center gap-1.5 sm:gap-2 text-center min-w-0'>
                                            <span
                                                className={`${textColorClass} font-medium whitespace-nowrap text-xs sm:text-sm`}
                                            >
                                                再生中:
                                            </span>
                                            <a
                                                href={searchUrl(musicTitle)}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                className={`${textColorClass} font-medium hover:underline break-words min-w-0 text-xs sm:text-sm`}
                                                title={musicTitle}
                                            >
                                                {musicTitle}
                                            </a>
                                        </span>
                                    );
                                }
                                return (
                                    <span className={`${textColorClass} font-medium text-xs sm:text-sm`}>再生中</span>
                                );
                            })()
                        )
                )
                : status.type === 'paused'
                ? <span className='text-gray-800 dark:text-gray-100 text-xs sm:text-sm'>一時停止中</span>
                : (
                    visibility === 'visible' && (
                        <span className='text-gray-800 dark:text-gray-100 text-xs sm:text-sm'>
                            タブが閉じられました
                        </span>
                    )
                )}
        </motion.div>
    );
}

function StatusBadgeInner({ status, music, mode }: StatusBadgeProps) {
    const settings = useSettingsStore();
    const resolvedMode = mode ?? settings.ytStatusMode;

    if (resolvedMode === 'player') return <AudioPlayer status={status} music={music} />;

    return <StatusBadgeCompact status={status} music={music} />;
}

export const StatusBadge = memo(StatusBadgeInner);
