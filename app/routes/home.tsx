import { useState, useEffect } from "react";
import { useGamingToggle } from "~/hooks/use-gaming-toggle";
import { Footer } from "~/components/footer/Footer";
import { SettingsButton } from "~/components/settings/SettingsButton";
import { SettingsPanel } from "~/components/settings/SettingsPanel";
import { YouTubeStatus } from "~/components/home/YouTubeStatus";
import { HomeForm } from "~/components/home/HomeForm";
import { Button } from "~/components/ui/button";
import { TrashIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { useMusicStore } from "~/stores/musicStore";
import type { Route } from "./+types/home";
import { useColorMode } from "~/hooks/use-color-mode";
import { useYouTubeStatus } from "~/hooks/use-youtube-status";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "音楽リクエストフォーム" },
    { name: "description", content: "浜松キャンパスの音楽リクエストフォームです。" },
  ];
}

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const gaming = useGamingToggle("-");
  const musics = useMusicStore((store) => store.musics);
  const initializeSocket = useMusicStore((store) => store.initializeSocket);
  const ytStatus = useYouTubeStatus();
  const { mode, setMode, darkClass } = useColorMode();

  useEffect(() => {
    initializeSocket();
  }, [initializeSocket]);

  const handleSettingsButtonClick = () => {
    setSettingsOpen((prev) => !prev);
  };

  return (
    <>
      <div
        className={`relative flex flex-col items-center justify-center mt-4 gap-4 w-xl mx-auto ${darkClass} ${gaming ? "gaming-links" : ""}`}
        style={{ paddingBottom: "80px" }}
      >
        <SettingsButton onClick={handleSettingsButtonClick} />
        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          mode={mode}
          setMode={setMode}
        />
        <h1
          className="text-2xl font-bold m-4"
          style={{
            color: mode === "dark" ? "#E8EAED" : "#212225",
          }}
        >
          楽曲リクエストフォーム
        </h1>
        <HomeForm mode={mode} onAdminModeChange={setIsAdmin} />

        {/* YouTube状態表示 */}
        <YouTubeStatus ytStatus={ytStatus} />

        {/* 楽曲リスト */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className={`text-center table-head-animated ${mode === "dark" ? "table-head-dark" : "table-head-light"}`}
              >
                楽曲
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {musics.length === 0 ? (
              <TableRow>
                <TableCell className="text-center text-muted-foreground">
                  楽曲がありません
                </TableCell>
              </TableRow>
            ) : (
              musics.map((music) => (
                <TableRow key={music.url}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <HoverCard>
                        <HoverCardTrigger
                          href={music.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 hover:underline transition-colors cursor-pointer long-title"
                          title={`${music.title}（新しいタブで開く）`}
                          aria-label={`${music.title}を再生（新規タブで開く）`}
                        >
                          {music.title}
                        </HoverCardTrigger>
                        <HoverCardContent>
                          <img src={music.thumbnail} alt={`${music.title}のサムネイル`} />
                        </HoverCardContent>
                      </HoverCard>
                      {isAdmin && (
                        <Button
                          type="button"
                          size="icon"
                          style={{ color: "#fff", background: "#dc2626" }}
                          aria-label="この曲を削除"
                          onClick={() => {
                            useMusicStore.getState().deleteMusic(music.url);
                          }}
                        >
                          <TrashIcon size={16} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Footer />
    </>
  );
}
