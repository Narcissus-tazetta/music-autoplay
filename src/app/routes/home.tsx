import { TrashIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminStatus } from "../../shared/components/AdminStatus";
import { HomeForm } from "../../features/music/components/HomeForm";
import { YouTubeStatus } from "../../features/music/components/YouTubeStatus";
import { useYouTubeStatus } from "../../features/music/hooks/use-youtube-status";
import { useMusicStore } from "../../features/music/stores/musicStore";
import { SettingsButton } from "../../features/settings/components/SettingsButton";
import { SettingsPanel } from "../../features/settings/components/SettingsPanel";
import { useColorModeStore } from "../../features/settings/stores/colorModeStore";
import { Button } from "../../components/button";
import { Footer } from "../../shared/components/Footer";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../components/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/table";
import { useAdminStore } from "../../stores/adminStore";

export const meta = () => [
  { title: "音楽リクエストフォーム" },
  {
    name: "description",
    content: "浜松キャンパスの音楽リクエストフォームです。",
  },
];

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const musics = useMusicStore((store) => store.musics);
  const isAdmin = useAdminStore((store) => store.isAdmin);
  const ytStatus = useYouTubeStatus();
  const mode = useColorModeStore((s) => s.mode);
  const setMode = useColorModeStore((s) => s.setMode);
  // dark class now applied to <html> by ThemeInitializer/store; no local darkClass

  const initializeSocket = useCallback(() => {
    const store = useMusicStore.getState();
    // initializeSocket exists on the store in client builds
    if (typeof store.initializeSocket === "function") store.initializeSocket();
  }, []);

  useEffect(() => {
    initializeSocket();
  }, [initializeSocket]);

  const handleSettingsButtonClick = () => {
    setSettingsOpen((prev) => !prev);
  };

  const colors =
    mode === "dark"
      ? { bg: "#212225", fg: "#E8EAED" }
      : { bg: "#fff", fg: "#212225" };

  return (
    <>
      <div
        className="relative flex flex-col items-center justify-center mt-4 gap-4 w-xl mx-auto"
        style={{
          paddingBottom: "80px",
          backgroundColor: colors.bg,
          color: colors.fg,
          transition:
            "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <SettingsButton onClick={handleSettingsButtonClick} />
        <SettingsPanel
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
          }}
          mode={mode}
          setMode={setMode}
          pageType="home"
        />
        <h1
          className="text-2xl font-bold m-4"
          style={{
            color: colors.fg,
            transition: "color 0.2s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          楽曲リクエストフォーム
        </h1>

        <AdminStatus />

        <HomeForm />

        <YouTubeStatus ytStatus={ytStatus} />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="text-center transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{
                  color: colors.fg,
                }}
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
                <TableRow key={music.id || music.url}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <a
                            href={music.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700 hover:underline transition-colors cursor-pointer whitespace-normal break-all"
                            title={`${music.title}（新しいタブで開く）`}
                            aria-label={`${music.title}を再生（新規タブで開く）`}
                          >
                            {music.title}
                          </a>
                        </HoverCardTrigger>
                        <HoverCardContent>
                          <img
                            src={music.thumbnail}
                            alt={`${music.title}のサムネイル`}
                          />
                        </HoverCardContent>
                      </HoverCard>
                      {isAdmin && (
                        <Button
                          type="button"
                          size="icon"
                          style={{ color: "#fff", background: "#dc2626" }}
                          aria-label="この曲を削除"
                          onClick={() => {
                            const store = useMusicStore.getState();
                            if (store.deleteMusicById) {
                              const id = music.id || null;
                              if (id) store.deleteMusicById(id);
                              else store.deleteMusic(music.url);
                            }
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
