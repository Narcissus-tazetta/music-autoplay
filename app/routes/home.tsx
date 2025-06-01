import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SendIcon } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useMusicStore } from "~/stores/musicStore";
import { useEffect, useState } from "react";
import type { Route } from "./+types/home";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import convert from "convert-iso8601-duration";

// 動画の状態と資産の型定義
interface YTStatus {
    state: 'playing' | 'paused' | 'window_close';
    url: string;
    music: {
        url: string;
        title: string;
        thumbnail: string;
    } | null;
}

interface VideoAssets {
    title: string;
    thumbnail: string;
    length: string;
    isMusic: boolean;
}

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

    // サーバーからのYouTube状態
    const [ytStatus, setYtStatus] = useState<YTStatus | null>(null);

    useEffect(() => {
        if (!socket) return;
        const handler = (data: any) => {
            // stateが想定外の場合はwindow_closeに変換
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
        const url = data.url;
        const videoId = parseUrl(url);
        if (videoId === null) {
            setError("url", {
                type: "onChange",
                message: "有効なYouTubeのURLを入力してください（例：https://www.youtube.com/watch?v=...）",
            });
            return;
        }

        const formData = new FormData();
        formData.append("videoId", videoId);

        const assets: VideoAssets = await fetch("/api/assets", {
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

    return (
        <div className="w-xl mx-auto flex flex-col items-center justify-center mt-4 gap-4">
            <h1 className="text-2xl font-bold m-4">楽曲リクエストフォーム</h1>
            <form className="flex flex-col items-center gap-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="w-full flex flex-col items-center">
                    <Input
                        className="w-[500px]"
                        {...register("url", {
                            required: "URLを入力してください",
                            pattern: {
                                value: pattern,
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
                <Button type="submit" className="flex w-xs gap-2">
                    <SendIcon size={12} />
                    <p>送信</p>
                </Button>
            </form>

            {/* YouTube状態表示 */}
            {ytStatus && ytStatus.music && (() => {
                const state = ytStatus.state;
                const music = ytStatus.music;
                let stateLabel = state;
                let color = "bg-gray-100 border-gray-400 text-gray-800";
                if (state === "playing") {
                    stateLabel = "playing";
                    color = "bg-green-100 border-green-500 text-green-800";
                } else if (state === "paused") {
                    stateLabel = "paused";
                    color = "bg-orange-100 border-orange-500 text-orange-800";
                } else if (state === "window_close") {
                    stateLabel = "window_close";
                    color = "bg-gray-200 border-gray-500 text-gray-800";
                }
                return (
                    <div className="w-full flex items-center justify-center my-2">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded border ${color}`} style={{ minWidth: 320 }}>
                            <span className="font-bold whitespace-nowrap">{stateLabel}：</span>
                            <HoverCard>
                                <HoverCardTrigger
                                    href={music.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 hover:underline transition-colors cursor-pointer"
                                >
                                    {music.title}
                                </HoverCardTrigger>
                                <HoverCardContent>
                                    <img src={music.thumbnail} alt={`${music.title}のサムネイル`} />
                                </HoverCardContent>
                            </HoverCard>
                        </div>
                    </div>
                );
            })()}

            {/* 楽曲リスト */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-center">楽曲</TableHead>
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
                                                aria-label={`${music.title}を再生（新しいタブで開きます）`}
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

const pattern = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;
function parseUrl(url: string): string | null {
    return url.match(pattern)?.[1] ?? null;
}
