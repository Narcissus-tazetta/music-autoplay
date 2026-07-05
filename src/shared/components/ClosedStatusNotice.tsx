import type { VisibilityState } from '@/shared/hooks/usePlayerState';
import { STATUS_PANEL_MOTION } from '@/shared/hooks/usePlayerState';
import { motion } from 'framer-motion';
import { memo } from 'react';

interface ClosedStatusNoticeProps {
    visibility: VisibilityState;
}

function ClosedStatusNoticeInner({ visibility }: ClosedStatusNoticeProps) {
    if (visibility === 'hidden') return null;

    return (
        <motion.div
            aria-live='polite'
            className='bg-gray-100 dark:bg-gray-900/10 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-1 rounded-md flex items-center gap-2 sm:gap-3 max-w-full'
            initial={STATUS_PANEL_MOTION.initial}
            animate={{
                ...STATUS_PANEL_MOTION.animate,
                opacity: visibility === 'visible' ? 1 : 0,
            }}
            exit={{ opacity: 0, y: -12 }}
            transition={STATUS_PANEL_MOTION.transition}
        >
            {visibility === 'visible' && (
                <span
                    className='inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 bg-gray-500'
                    aria-hidden
                />
            )}
            <span className='text-gray-800 dark:text-gray-100 font-medium text-xs sm:text-sm'>
                タブが閉じられました
            </span>
        </motion.div>
    );
}

export const ClosedStatusNotice = memo(ClosedStatusNoticeInner);
