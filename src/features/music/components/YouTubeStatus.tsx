import { Textfit } from "react-textfit";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/hover-card";

interface YouTubeStatusProps {
  ytStatus: {
    state: "playing" | "paused" | "window_close";
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
  let stateLabel = "";
  let stateClass = "";

  if (state === "playing") {
    stateLabel = "再生中";
    stateClass = match
      ? "bg-[#f0fdf4] border-[#22c55e] text-[#166534] dark:bg-[#26302a] dark:border-[#22c55e] dark:text-[#7fffa1]"
      : "bg-[#faf5ff] border-[#a855f7] text-[#7c2d92] dark:bg-[#332a3f] dark:border-[#a855f7] dark:text-[#d8b4fe]";
  } else if (state === "paused") {
    stateLabel = "停止中";
    stateClass = match
      ? "bg-[#fff7ed] border-[#f59e42] text-[#c2410c] dark:bg-[#3a3227] dark:border-[#f59e42] dark:text-[#ffd7a0]"
      : "bg-[#f0f9ff] border-[#3b82f6] text-[#1d4ed8] dark:bg-[#1e3a8a] dark:border-[#3b82f6] dark:text-[#93c5fd]";
  } else {
    stateLabel = "タブが閉じました";
    stateClass =
      "bg-[#f3f4f6] border-[#94a3b8] text-[#334155] dark:bg-[#23272e] dark:border-[#94a3b8] dark:text-[#bfc9d1]";
  }

  const displayLabel = match ? stateLabel : `${stateLabel} (リスト外)`;

  return (
    <div className="w-full flex items-center justify-center my-2">
      <div
        className={`w-full max-w-[900px] min-w-[320px] px-5 py-2 rounded-[12px] border-[1.5px] font-bold gap-0 flex items-center justify-center ${stateClass}`}
      >
        <Textfit mode="single" max={22} min={1} style={{ marginRight: "2px" }}>
          {displayLabel}：
        </Textfit>
        <HoverCard>
          <HoverCardTrigger
            href={music.url}
            target="_blank"
            rel="noopener noreferrer"
            title={music.title}
            aria-label={`${music.title}を再生（新しいタブで開きます）`}
            className="text-blue-500 hover:text-blue-700 hover:underline transition-colors cursor-pointer max-w-[650px] whitespace-nowrap overflow-hidden text-ellipsis inline-block"
          >
            <Textfit mode="single" max={20} min={1}>
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
