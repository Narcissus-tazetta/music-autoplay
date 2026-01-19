import { type JSX, useCallback } from 'react';
import { ErrorDisplay, ShortcutInfo, UrlListSection, VideoControlButtons } from '../components';
import { useUrlList, useYouTubeControls } from '../hooks';

export default function Popup(): JSX.Element {
    const { urls, error, removeUrl } = useUrlList();
    const { handleControl, openFirstUrl, openUrl } = useYouTubeControls(urls);

    const onOpenFirstUrl = useCallback(() => {
        openFirstUrl(urls);
    }, [openFirstUrl, urls]);

    return (
        <div className='p-4 bg-linear-to-br from-slate-50 to-blue-50 text-slate-800 mx-auto max-w-85 w-full'>
            <VideoControlButtons onControl={handleControl} />
            <UrlListSection
                urls={urls}
                onOpenFirstUrl={onOpenFirstUrl}
                onOpenUrl={openUrl}
                onRemoveUrl={removeUrl}
            />
            <ErrorDisplay error={error} />
            <ShortcutInfo />
        </div>
    );
}
