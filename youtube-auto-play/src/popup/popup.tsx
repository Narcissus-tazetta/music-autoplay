import { type JSX, useCallback } from 'react';
import {
    ErrorDisplay,
    FeatureDescription,
    FeatureToggleButtons,
    ShortcutInfo,
    UrlListSection,
    VideoControlButtons,
} from '../components';
import { useChromeStorage, useUrlList, useYouTubeControls } from '../hooks';
import { sendChromeMessage } from '../utils/chrome';

export default function Popup(): JSX.Element {
    const [autoTab = false, setAutoTab] = useChromeStorage('manualAutoPlayEnabled', false);
    const [deadline = true, setDeadline] = useChromeStorage('deadlineEnabled', true);

    const { urls, error, removeUrl } = useUrlList();
    const { handleControl, openFirstUrl, openUrl } = useYouTubeControls(urls);

    const toggleAutoTab = useCallback(async () => {
        const newAutoTab = !autoTab;
        await setAutoTab(newAutoTab);
        await sendChromeMessage({ type: 'set_manual_autoplay', enabled: newAutoTab });
    }, [autoTab, setAutoTab]);

    const toggleDeadline = useCallback(async () => {
        const newDeadline = !deadline;
        await setDeadline(newDeadline);
        await sendChromeMessage({ type: 'set_deadline', enabled: newDeadline });
    }, [deadline, setDeadline]);

    const onOpenFirstUrl = useCallback(() => {
        openFirstUrl(urls);
    }, [openFirstUrl, urls]);

    return (
        <div className='p-4 bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800 mx-auto max-w-[340px] w-full'>
            <VideoControlButtons onControl={handleControl} />
            <UrlListSection
                urls={urls}
                onOpenFirstUrl={onOpenFirstUrl}
                onOpenUrl={openUrl}
                onRemoveUrl={removeUrl}
            />
            <ErrorDisplay error={error} />
            <FeatureToggleButtons
                autoTab={autoTab}
                deadline={deadline}
                onToggleAutoTab={toggleAutoTab}
                onToggleDeadline={toggleDeadline}
            />
            <ShortcutInfo />
            <FeatureDescription />
        </div>
    );
}
