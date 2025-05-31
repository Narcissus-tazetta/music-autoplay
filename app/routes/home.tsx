import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SendIcon } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useMusicStore } from "~/stores/musicStore";
import type { Route } from "./+types/home";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import convert from "convert-iso8601-duration";

export function meta({}: Route.MetaArgs) {
    return [{ title: "Music Auto Play" }, { name: "description", content: "Welcome to Music Auto Play!" }];
}

interface Inputs {
    url: string;
}

export default function Home() {
    const musics = useMusicStore((store) => store.musics);
    const error = useMusicStore((store) => store.error);
    const {
        register,
        handleSubmit,
        resetField,
        setError,
        formState: { errors },
    } = useForm<Inputs>();

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        const url = data.url;
        const videoId = parseUrl(url);
        if (videoId === null) {
            setError("url", {
                type: "onChange",
                message: "有効なYouTubeのURLを入力してください",
            });
            return;
        }

        const formData = new FormData();
        formData.append("videoId", videoId);

        const assets: {
            title: string;
            thumbnail: string;
            length: string;
            isMusic: boolean;
        } = await fetch("/api/assets", {
            method: "POST",
            body: formData,
        }).then(async (res) => {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error(e, text);
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
                            required: true,
                            onChange() {
                                useMusicStore.getState().resetError();
                            },
                        })}
                        autoComplete="off"
                        placeholder="例：https://www.youtube.com/watch?v=..."
                    />
                    <p className="text-red-500 text-sm">{error}</p>
                    {errors.url && <p className="text-red-500 text-sm">{errors.url.message}</p>}
                </div>
                <Button type="submit" className="flex w-xs gap-2">
                    <SendIcon size={12} />
                    <p>送信</p>
                </Button>
            </form>
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
                                                className="text-blue-500 hover:text-blue-700 hover:text-decoration-line transition-colors cursor-pointer"
                                                title="クリックして再生"
                                                aria-label="クリックして再生"
                                            >
                                                {music.title}
                                            </HoverCardTrigger>
                                            <HoverCardContent>
                                                <img src={music.thumbnail} />
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
