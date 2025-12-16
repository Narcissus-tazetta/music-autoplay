import { Settings } from 'lucide-react';
import type { FC } from 'react';
import { memo, useCallback, useRef, useState } from 'react';
import { UI_TEXT } from '../constants';
import type { ExtensionMode } from '../types';

interface Props {
    extensionMode: ExtensionMode;
    onCycleMode: () => void;
    onRevealMode: () => void;
}

export const ExtensionModeToggle: FC<Props> = memo(({ extensionMode, onCycleMode, onRevealMode }) => {
    const [longPressActive, setLongPressActive] = useState(false);
    const timerRef = useRef<number | null>(null);

    const handleMouseDown = useCallback(() => {
        setLongPressActive(false);
        timerRef.current = window.setTimeout(() => {
            setLongPressActive(true);
            onRevealMode();
        }, 600);
    }, [onRevealMode]);

    const handleMouseUp = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!longPressActive) onCycleMode();
        setLongPressActive(false);
    }, [longPressActive, onCycleMode]);

    const handleMouseLeave = useCallback(() => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setLongPressActive(false);
    }, []);

    const modeLabel = extensionMode === 'auto'
        ? UI_TEXT.MODE_AUTO
        : extensionMode === 'local'
        ? UI_TEXT.MODE_LOCAL
        : UI_TEXT.MODE_PRODUCTION;
    const modeColor = extensionMode === 'auto' ? 'purple' : extensionMode === 'local' ? 'orange' : 'gray';

    return (
        <button
            id='extension-mode-toggle'
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            className={`w-full h-12 rounded-lg font-semibold shadow-sm transition-all text-sm flex items-center justify-center gap-2 ${
                modeColor === 'purple'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : modeColor === 'orange'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
            aria-label={`${UI_TEXT.MODE_LABEL}: ${modeLabel}`}
        >
            <Settings size={20} />
            {UI_TEXT.MODE_LABEL}: {modeLabel}
        </button>
    );
});

ExtensionModeToggle.displayName = 'ExtensionModeToggle';
