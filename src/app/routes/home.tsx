import { TrashIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminStatus } from "../../features/music/components/AdminStatus";
import { HomeForm } from "../../features/music/components/HomeForm";
import { YouTubeStatus } from "../../features/music/components/YouTubeStatus";
import { useYouTubeStatus } from "../../features/music/hooks/use-youtube-status";
import { useMusicStore } from "../../features/music/stores/musicStore";
import { SettingsButton } from "../../features/settings/components/SettingsButton";
import { SettingsPanel } from "../../features/settings/components/SettingsPanel";
import { useColorModeStore } from "../../features/settings/stores/colorModeStore";
import { Button } from "../../components/button";
import { Footer } from "../../components/Footer";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../components/hover-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/table";
import { useGamingToggle } from "../../hooks/use-gaming-toggle";
import { useAdminStore } from "../../stores/adminStore";

export const meta = () => [
    { title: "音楽リクエストフォーム" },
    { name: "description", content: "浜松キャンパスの音楽リクエストフォームです。" },
];

export default function Home() {
    const [settingsOpen, setSettingsOpen] = useState(false);

    const gaming = useGamingToggle("-");
    const musics = useMusicStore((store) => store.musics);
    const isAdmin = useAdminStore((store) => store.isAdmin);
    const ytStatus = useYouTubeStatus();
    const mode = useColorModeStore((s) => s.mode);
    const setMode = useColorModeStore((s) => s.setMode);
    const darkClass = useColorModeStore((s) => s.darkClass);

    const initializeSocket = useCallback(() => {
        const store = useMusicStore.getState();
        if (store.initializeSocket) {
            store.initializeSocket();
        }
    }, []);

    useEffect(() => {
        initializeSocket();
    }, [initializeSocket]);

    const handleSettingsButtonClick = () => {
        setSettingsOpen((prev) => !prev);
    };

    const colors = mode === "dark" ? { bg: "#212225", fg: "#E8EAED" } : { bg: "#fff", fg: "#212225" };

    return (
        <>
            <div
                className={`relative flex flex-col items-center justify-center mt-4 gap-4 w-xl mx-auto ${darkClass} ${
                    gaming ? "gaming-links" : ""
                }`}
                style={{
                    paddingBottom: "80px",
                    backgroundColor: colors.bg,
                    color: colors.fg,
                    transition: "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)",
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
                                className="text-center table-head-animated"
                                style={{
                                    color: colors.fg,
                                    transition: "color 0.2s cubic-bezier(0.4,0,0.2,1)",
                                }}
                            >
                                楽曲
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {musics.length === 0 ? (
                            <TableRow>
                                <TableCell className="text-center text-muted-foreground">楽曲がありません</TableCell>
                            </TableRow>
                        ) : (
                            musics.map((music) => (
                                <TableRow key={music.url}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <HoverCard>
                                                <HoverCardTrigger asChild>
                                                    <a
                                                        href={music.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-700 hover:underline transition-colors cursor-pointer long-title"
                                                        title={`${music.title}（新しいタブで開く）`}
                                                        aria-label={`${music.title}を再生（新規タブで開く）`}
                                                    >
                                                        {music.title}
                                                    </a>
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
                                                        const store = useMusicStore.getState();
                                                        if (store.deleteMusic) {
                                                            store.deleteMusic(music.url);
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
