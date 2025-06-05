// 移動元: ../YouTubeStatus.tsx
import React from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { Textfit } from "react-textfit";

interface YouTubeStatusProps {
  ytStatus: {
    state: 'playing' | 'paused' | 'window_close';
    music: {
      url: string;
      title: string;
      thumbnail: string;
    } | null;
  };
}

export const YouTubeStatus: React.FC<YouTubeStatusProps> = ({ ytStatus }) => {
  if (!ytStatus || !ytStatus.music) return null;
  const { state, music } = ytStatus;
  let stateLabel = "";
  let containerClass = "youtube-status-container youtube-status-closed";
  if (state === "playing") {
    stateLabel = "再生中";
    containerClass = "youtube-status-container youtube-status-playing";
  } else if (state === "paused") {
    stateLabel = "停止中";
    containerClass = "youtube-status-container youtube-status-paused";
  } else if (state === "window_close") {
    stateLabel = "タブが閉じました";
  }
  return (
    <div className="w-full flex items-center justify-center my-2">
      <div className={containerClass}>
        <Textfit mode="single" max={22} min={1} style={{ marginRight: "2px" }}>
          {stateLabel}：
        </Textfit>
        <HoverCard>
          <HoverCardTrigger
            href={music.url}
            target="_blank"
            rel="noopener noreferrer"
            className="youtube-title"
            title={music.title}
            aria-label={`${music.title}を再生（新しいタブで開きます）`}
          >
            <Textfit mode="single" max={20} min={1} style={{ maxWidth: "650px" }}>
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
