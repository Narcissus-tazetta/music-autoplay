import { type JSX, useCallback, useEffect, useState } from 'react';
import { ErrorDisplay, FeatureToggleButtons, ShortcutInfo, UrlListSection, VideoControlButtons } from '../components';
import { useChromeStorage, useUrlList, useYouTubeControls } from '../hooks';
import type { ExtensionMode } from '../types';

export default function Popup(): JSX.Element {
    const [extensionMode = 'auto', setExtensionMode] = useChromeStorage('extensionMode', 'auto');

    const { urls, error, removeUrl } = useUrlList();
    const { handleControl, openFirstUrl, openUrl } = useYouTubeControls(urls);

    const cycleMode = useCallback(async () => {
        const nextMode: ExtensionMode = extensionMode === 'auto'
            ? 'local'
            : extensionMode === 'local'
            ? 'production'
            : 'auto';
        await setExtensionMode(nextMode);
    }, [extensionMode, setExtensionMode]);

    const [hiddenUiVisible, setHiddenUiVisible] = useState(false);

    const revealMode = useCallback(() => {
        setHiddenUiVisible(v => !v);
    }, []);

    useEffect(() => {
        const handleMessage = (message: any) => {
            if (message?.type === 'toggle_hidden_ui') {
                if (typeof document !== 'undefined' && document.hidden) return;
                setHiddenUiVisible(v => !v);
            }
        };
        (chrome.runtime.onMessage as any).addListener(handleMessage);
        return () => {
            try {
                (chrome.runtime.onMessage as any).removeListener(handleMessage);
            } catch {}
        };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
            const meta = isMac ? e.metaKey : e.ctrlKey;
            if (meta && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
                e.preventDefault();
                setHiddenUiVisible(v => !v);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

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
            <FeatureToggleButtons
                extensionMode={extensionMode}
                onCycleMode={cycleMode}
                onRevealMode={revealMode}
                showExtensionToggle={hiddenUiVisible}
            />
            <ShortcutInfo />
        </div>
    );
}
