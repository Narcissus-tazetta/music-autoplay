import { Textfit } from 'react-textfit';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../../shared/components/hover-card';

interface YouTubeStatusProps {
    ytStatus: {
        state: 'playing' | 'paused' | 'window_close';
        match: boolean;
        music: {
            url: string;
            title: string;
            thumbnail: string;
        } | null;
    } | null;
}

export const YouTubeStatus = ({ ytStatus }: YouTubeStatusProps) => {
    if (!ytStatus || !ytStatus.music) return null;
    const { state, match, music } = ytStatus;
    let stateLabel = '';
    let containerClass = 'youtube-status-container youtube-status-closed';

    if (state === 'playing') {
        stateLabel = '再生中';
        containerClass = match
            ? 'youtube-status-container youtube-status-playing'
            : 'youtube-status-container youtube-status-playing youtube-status-unlisted';
    } else if (state === 'paused') {
        stateLabel = '停止中';
        containerClass = match
            ? 'youtube-status-container youtube-status-paused'
            : 'youtube-status-container youtube-status-paused youtube-status-unlisted';
    } else {
        stateLabel = 'タブが閉じました';
    }

    const displayLabel = match ? stateLabel : `${stateLabel} (リスト外)`;

    return (
        <div className='w-full flex items-center justify-center my-2'>
            <div className={containerClass}>
                <Textfit mode='single' max={22} min={1} style={{ marginRight: '2px' }}>
                    {displayLabel}：
                </Textfit>
                <HoverCard>
                    <HoverCardTrigger
                        href={music.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='youtube-title'
                        title={music.title}
                        aria-label={`${music.title}を再生（新しいタブで開きます）`}
                    >
                        <Textfit mode='single' max={20} min={1} style={{ maxWidth: '650px' }}>
                            {music.title}
                        </Textfit>
                    </HoverCardTrigger>
                    <HoverCardContent>
                        <img src={music.thumbnail} alt={`${music.title}のサムネイル`} />
                    </HoverCardContent>
                </HoverCard>
            </div>
        </div>
    );
};
