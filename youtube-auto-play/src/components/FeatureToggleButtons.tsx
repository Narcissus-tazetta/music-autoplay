import { Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import type { FC } from 'react';
import { memo } from 'react';
import { UI_TEXT } from '../constants';

interface Props {
    autoTab: boolean;
    deadline: boolean;
    onToggleAutoTab: () => void;
    onToggleDeadline: () => void;
}

export const FeatureToggleButtons: FC<Props> = memo(
    ({ autoTab, deadline, onToggleAutoTab, onToggleDeadline }) => (
        <div className='flex flex-col gap-2 mb-4'>
            <button
                id='manual-autoplay-toggle'
                onClick={onToggleAutoTab}
                className={`h-12 rounded-lg font-semibold shadow-sm transition-all text-sm flex items-center justify-center gap-2 ${
                    autoTab
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-white hover:bg-blue-50 border border-blue-200 text-blue-700'
                }`}
            >
                {autoTab ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                {UI_TEXT.AUTO_TAB_LABEL}: {autoTab ? UI_TEXT.EXTENSION_STATUS_ON : UI_TEXT.EXTENSION_STATUS_OFF}
            </button>
            <button
                id='deadline-toggle'
                onClick={onToggleDeadline}
                className={`h-12 rounded-lg font-semibold shadow-sm transition-all text-sm flex items-center justify-center gap-2 ${
                    deadline
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-white hover:bg-green-50 border border-green-200 text-green-700'
                }`}
            >
                <Clock size={20} />
                {UI_TEXT.DEADLINE_LABEL}: {deadline ? UI_TEXT.EXTENSION_STATUS_ON : UI_TEXT.EXTENSION_STATUS_OFF}
            </button>
        </div>
    ),
);

FeatureToggleButtons.displayName = 'FeatureToggleButtons';
