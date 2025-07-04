import { useEffect, useState } from 'react';
import { Footer } from '../../../shared/components/Footer';
import { createBackgroundStyle } from '../../../shared/utils/time/background-utils';
import { SettingsButton } from '../../settings/components/SettingsButton';
import { SettingsPanel } from '../../settings/components/SettingsPanel';
import { useProgressSettings } from '../../settings/hooks/use-progress-settings';
import { useColorModeStore } from '../../settings/stores/colorModeStore';
import { useProgressSettingsStore } from '../../settings/stores/progressSettingsStore';
import { useClientOnly } from '../hooks/use-client-only';
import { DateDisplay } from './DateDisplay';
import { TimeDisplay } from './TimeDisplay';

interface TimePageLayoutProps {
    status: {
        timeRemaining?: string;
        next?: { label: string } | null;
        current?: { label: string } | null;
        remainingMs?: number | null;
        totalDurationMs?: number;
    };
}

/**
 * 時間ページのメインレイアウトコンポーネント
 */
const TimePageLayout = ({ status }: TimePageLayoutProps) => {
    const [settingsOpen, setSettingsOpen] = useState(false);

    // ColorModeStoreから必要最小限の状態のみを取得
    const mode = useColorModeStore(s => s.mode);
    const setMode = useColorModeStore(s => s.setMode);
    const darkClass = useColorModeStore(s => s.darkClass);

    const isClient = useClientOnly();

    const { backgroundImage, setBackgroundImage } = useProgressSettings();

    // ProgressSettingsStoreからも必要最小限の状態のみを個別に取得
    const showRemainingText = useProgressSettingsStore(s => s.showRemainingText);
    const setShowRemainingText = useProgressSettingsStore(s => s.setShowRemainingText);
    const showCurrentSchedule = useProgressSettingsStore(s => s.showCurrentSchedule);
    const setShowCurrentSchedule = useProgressSettingsStore(s => s.setShowCurrentSchedule);
    const showProgress = useProgressSettingsStore(s => s.showProgress);
    const setShowProgress = useProgressSettingsStore(s => s.setShowProgress);
    const progressColor = useProgressSettingsStore(s => s.progressColor);
    const setProgressColor = useProgressSettingsStore(s => s.setProgressColor);

    // Date settings
    const showDate = useProgressSettingsStore(s => s.showDate);
    const setShowDate = useProgressSettingsStore(s => s.setShowDate);
    const showYear = useProgressSettingsStore(s => s.showYear);
    const setShowYear = useProgressSettingsStore(s => s.setShowYear);
    const showMonth = useProgressSettingsStore(s => s.showMonth);
    const setShowMonth = useProgressSettingsStore(s => s.setShowMonth);
    const showDay = useProgressSettingsStore(s => s.showDay);
    const setShowDay = useProgressSettingsStore(s => s.setShowDay);
    const showWeekday = useProgressSettingsStore(s => s.showWeekday);
    const setShowWeekday = useProgressSettingsStore(s => s.setShowWeekday);
    const yearFormat = useProgressSettingsStore(s => s.yearFormat);
    const setYearFormat = useProgressSettingsStore(s => s.setYearFormat);
    const monthFormat = useProgressSettingsStore(s => s.monthFormat);
    const setMonthFormat = useProgressSettingsStore(s => s.setMonthFormat);
    const dayFormat = useProgressSettingsStore(s => s.dayFormat);
    const setDayFormat = useProgressSettingsStore(s => s.setDayFormat);
    const weekdayFormat = useProgressSettingsStore(s => s.weekdayFormat);
    const setWeekdayFormat = useProgressSettingsStore(s => s.setWeekdayFormat);

    // Background settings
    const showBackgroundImage = useProgressSettingsStore(s => s.showBackgroundImage);
    const setShowBackgroundImage = useProgressSettingsStore(s => s.setShowBackgroundImage);
    const backgroundImageFileName = useProgressSettingsStore(s => s.backgroundImageFileName);
    const backgroundFeatureEnabled = useProgressSettingsStore(s => s.backgroundFeatureEnabled);
    const setBackgroundFeatureEnabled = useProgressSettingsStore(
        s => s.setBackgroundFeatureEnabled,
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey && event.shiftKey && event.key === ' ') {
                event.preventDefault();
                setBackgroundFeatureEnabled(!backgroundFeatureEnabled);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [backgroundFeatureEnabled, setBackgroundFeatureEnabled]);

    const backgroundStyle = createBackgroundStyle(showBackgroundImage, backgroundImage);

    const colors = mode === 'dark' ? { bg: '#212225', fg: '#E8EAED' } : { bg: '#fff', fg: '#212225' };
    const finalStyle = {
        ...backgroundStyle,
        backgroundColor: colors.bg,
        color: colors.fg,
        transition: 'background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)',
    };

    return (
        <>
            <div
                className={`min-h-screen bg-base-200 flex items-center justify-center p-4 ${darkClass}`}
                style={finalStyle}
            >
                <SettingsButton
                    onClick={() => {
                        setSettingsOpen(!settingsOpen);
                    }}
                />
                <SettingsPanel
                    open={settingsOpen}
                    onClose={() => {
                        setSettingsOpen(false);
                    }}
                    mode={mode}
                    setMode={setMode}
                    pageType='time'
                    showProgress={showProgress}
                    setShowProgress={setShowProgress}
                    progressColor={progressColor}
                    setProgressColor={setProgressColor}
                    showRemainingText={showRemainingText}
                    setShowRemainingText={setShowRemainingText}
                    showCurrentSchedule={showCurrentSchedule}
                    setShowCurrentSchedule={setShowCurrentSchedule}
                    showDate={showDate}
                    setShowDate={setShowDate}
                    showYear={showYear}
                    setShowYear={setShowYear}
                    showMonth={showMonth}
                    setShowMonth={setShowMonth}
                    showDay={showDay}
                    setShowDay={setShowDay}
                    showWeekday={showWeekday}
                    setShowWeekday={setShowWeekday}
                    yearFormat={yearFormat}
                    setYearFormat={setYearFormat}
                    monthFormat={monthFormat}
                    setMonthFormat={setMonthFormat}
                    dayFormat={dayFormat}
                    setDayFormat={setDayFormat}
                    weekdayFormat={weekdayFormat}
                    setWeekdayFormat={setWeekdayFormat}
                    backgroundImage={backgroundImage}
                    setBackgroundImage={setBackgroundImage}
                    backgroundImageFileName={backgroundImageFileName}
                    showBackgroundImage={showBackgroundImage}
                    setShowBackgroundImage={setShowBackgroundImage}
                    backgroundFeatureEnabled={backgroundFeatureEnabled}
                />

                <div className='text-center select-none space-y-4'>
                    <DateDisplay
                        show={showDate}
                        showYear={showYear}
                        showMonth={showMonth}
                        showDay={showDay}
                        showWeekday={showWeekday}
                        yearFormat={yearFormat}
                        monthFormat={monthFormat}
                        dayFormat={dayFormat}
                        weekdayFormat={weekdayFormat}
                    />

                    <TimeDisplay
                        isClient={isClient}
                        timeRemaining={status.timeRemaining}
                        next={status.next}
                        current={status.current}
                        remainingMs={status.remainingMs}
                        totalDurationMs={status.totalDurationMs}
                        showRemainingText={showRemainingText}
                        showCurrentSchedule={showCurrentSchedule}
                        showProgress={showProgress}
                        progressColor={progressColor}
                    />
                </div>
            </div>

            <Footer />
        </>
    );
};

export default TimePageLayout;
