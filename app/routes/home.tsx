import { useEffect, useState } from "react";
import { SettingsButton } from "../components/SettingsButton";
import { SettingsPanel } from "../components/SettingsPanel";
import { YouTubeStatus } from "../components/YouTubeStatus";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { SendIcon } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/hover-card";
import { useMusicStore } from "../stores/musicStore";
import type { Route } from "./+types/home";
import convert from "convert-iso8601-duration";
import { COLORS, useSmoothBodyColor, changeMode, parseYoutubeUrl, YOUTUBE_PATTERN } from "../libs/utils";


export function meta({}: Route.MetaArgs) {
    return [{ title: "Music Auto Play" }, { name: "description", content: "Welcome to Music Auto Play!" }];
}

export default function Home() {
    interface Inputs {
        url: string;
    }

    const musics = useMusicStore((store) => store.musics);
    const error = useMusicStore((store) => store.error);
    const socket = useMusicStore((store) => store.socket);
    const [ytStatus, setYtStatus] = useState<any>(null);

    useEffect(() => {
        if (!socket) return;
        const handler = (data: any) => {
            let state: 'playing' | 'paused' | 'window_close' = 'paused';
            if (data.state === 'playing' || data.state === 'paused' || data.state === 'window_close') {
                state = data.state;
            } else if (data.state === 'closed') {
                state = 'window_close';
            }
            setYtStatus({ ...data, state });
        };
        socket.on("current_youtube_status", handler);
        return () => {
            socket.off("current_youtube_status", handler);
        };
    }, [socket]);

    const {
        register,
        handleSubmit,
        resetField,
        setError,
        formState: { errors },
    } = useForm<Inputs>();

    // フォーム送信処理
    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        if (musics.length >= 50) {
            setError("url", {
                type: "manual",
                message: "これ以上は送信できません。リストは50件までです。",
            });
            return;
        }

        const url = data.url;
        const videoId = parseYoutubeUrl(url);
        if (videoId === null) {
            setError("url", {
                type: "onChange",
                message: "有効なYouTubeのURLを入力してください（例：https://www.youtube.com/watch?v=...）",
            });
            return;
        }

        const formData = new FormData();
        formData.append("videoId", videoId);

        const assets = await fetch("/api/assets", {
            method: "POST",
            body: formData,
        }).then(async (res) => {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error(e, text);
                throw new Error("サーバーからの応答が不正です");
            }
        });

        if (convert(assets.length) > 60 * 10) {
            setError("url", {
                type: "onChange",
                message: "10分以上の動画は登録できません",
            });
            return;
        }

        if (!assets.isMusic) {
            setError("url", {
                type: "onChange",
                message: "音楽以外の動画は登録できません",
            });
            return;
        }

        useMusicStore.getState().addMusic({ url, title: assets.title, thumbnail: assets.thumbnail });
        resetField("url");
    };

    // 設定パネルの開閉
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [mode, setModeState] = useState<"dark" | "light">("light");

    // 初回ロード時にlocalStorageから取得
    useEffect(() => {
      const savedMode = (localStorage.getItem("selectedMode") as "dark" | "light") || "light";
      setModeState(savedMode);
      changeMode(savedMode);
    }, []);

    // ダーク・ライトのbody色をスムーズに
    useSmoothBodyColor(
      mode === "dark" ? "#212225" : "#fff",
      mode === "dark" ? "#E8EAED" : "#212225"
    );

    // モード変更時の副作用
    const setMode = (newMode: "dark" | "light") => {
      setModeState(newMode);
      changeMode(newMode);
    };

    const darkClass = mode === "dark" ? "dark-mode" : "";

    // 設定ボタンのトグル動作に修正
    const handleSettingsButtonClick = () => {
      setSettingsOpen((prev) => !prev);
    };

    return (
        <div className={`relative flex flex-col items-center justify-center mt-4 gap-4 w-xl mx-auto ${darkClass}`}>
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
                color: mode === "dark" ? "#E8EAED" : "#212225"
              }}
            >
              楽曲リクエストフォーム
            </h1>
            <form className="flex flex-col items-center gap-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="w-full flex flex-col items-center">
                    <Input
                        className="w-[500px]"
                        {...register("url", {
                            required: "URLを入力してください",
                            pattern: {
                                value: YOUTUBE_PATTERN,
                                message: "有効なYouTubeのURLを入力してください"
                            },
                            onChange() {
                                useMusicStore.getState().resetError();
                            },
                        })}
                        autoComplete="off"
                        placeholder="例：https://www.youtube.com/watch?v=..."
                        aria-label="YouTubeのURL"
                    />
                    <p className="text-red-500 text-sm">{error}</p>
                    {errors.url && <p className="text-red-500 text-sm">{errors.url?.message}</p>}
                </div>
                <Button
                  type="submit"
                  className="flex w-xs gap-2"
                  style={{
                    background: mode === "dark" ? "#E8EAED" : "#212225",
                    color: mode === "dark" ? "#212225" : "#fff",
                    border: "none"
                  }}
                >
                    <SendIcon size={12} />
                    <p>送信</p>
                </Button>
            </form>

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
                            <TableCell className="text-center text-muted-foreground">楽曲がありません</TableCell>
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
                                                className="text-blue-500 hover:text-blue-700 hover:underline transition-colors cursor-pointer"
                                                title={`${music.title}（新しいタブで開く）`}
                                                aria-label={`${music.title}を再生（新規タブで開く）`}
                                            >
                                                {music.title}
                                            </HoverCardTrigger>
                                            <HoverCardContent>
                                                <img src={music.thumbnail} alt={`${music.title}のサムネイル`} />
                                            </HoverCardContent>
                                        </HoverCard>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}


