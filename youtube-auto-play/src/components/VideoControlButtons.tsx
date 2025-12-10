import { FastForward, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type { FC } from 'react';
import { memo } from 'react';
import { UI_TEXT } from '../constants';
import type { ControlName } from '../types';

interface Props {
    onControl: (name: ControlName) => void;
}

const buttonBaseClass =
    'h-12 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center justify-center gap-2';
const secondaryButtonClass = `${buttonBaseClass} border border-blue-200 bg-white hover:bg-blue-50 text-blue-700`;
const primaryButtonClass = `${buttonBaseClass} bg-blue-500 hover:bg-blue-600 text-white font-semibold`;

export const VideoControlButtons: FC<Props> = memo(({ onControl }) => (
    <div className='grid grid-cols-2 gap-2 mb-4'>
        <button onClick={() => onControl('prev')} className={secondaryButtonClass}>
            <SkipBack size={18} />
            {UI_TEXT.PREV_BUTTON}
        </button>
        <button onClick={() => onControl('next')} className={secondaryButtonClass}>
            <SkipForward size={18} />
            {UI_TEXT.NEXT_BUTTON}
        </button>
        <button onClick={() => onControl('pause')} className={secondaryButtonClass}>
            <Pause size={18} />
            {UI_TEXT.PAUSE_BUTTON}
        </button>
        <button onClick={() => onControl('play')} className={secondaryButtonClass}>
            <Play size={18} />
            {UI_TEXT.PLAY_BUTTON}
        </button>
        <button onClick={() => onControl('skip')} className={`col-span-2 ${primaryButtonClass}`}>
            <FastForward size={18} />
            {UI_TEXT.SKIP_BUTTON}
        </button>
    </div>
));

VideoControlButtons.displayName = 'VideoControlButtons';
