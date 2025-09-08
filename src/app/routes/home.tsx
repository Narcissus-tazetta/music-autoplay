import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { Alert } from "@shadcn/alert";
import { hash } from "crypto";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircleIcon, Loader, Send, TrashIcon } from "lucide-react";
import { useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { Badge } from "~/components/ui/shadcn/badge";
import { Button } from "~/components/ui/shadcn/button";
import { Card } from "~/components/ui/shadcn/card";
import { Input } from "~/components/ui/shadcn/input";
import { Table } from "~/components/ui/shadcn/table";
import type { action as actionMusicAdd } from "~/routes/api/music.add.server";
import { loginSession } from "~/sessions.server";
import { useMusicStore } from "~/stores/musicStore";

const youtubeUrlSchema = z
    .string({ required_error: "URLの入力は必須です" })
    .url("有効なURLを入力してください")
    .refine((url) => /^https:\/\/www\.youtube\.com\/watch\?v=./.test(url) || /^https:\/\/youtu\.be\//.test(url), {
        message: "有効なYouTubeのURLではありません",
    });

const addMusicSchema = z.object({
    url: youtubeUrlSchema,
});

export const meta = () => [
    { title: "楽曲リクエストフォーム" },
    { name: "description", content: "浜松キャンパスの楽曲リクエストフォームです。" },
];

export const loader = async ({ request }: ActionFunctionArgs) => {
    const session = await loginSession.getSession(request.headers.get("Cookie"));
    const user = session.get("user");

    return {
        userHash: user ? hash("sha256", user.id) : undefined,
    };
};

export default function Home() {
    const { userHash } = useLoaderData<typeof loader>();

    const musics = useMusicStore((state) => state.musics);
    const remoteStatus = useMusicStore((state) => state.remoteStatus);
    const fetcher = useFetcher<typeof actionMusicAdd>();
    const [form, fields] = useForm({
        shouldValidate: "onInput",
        onValidate(context) {
            return parseWithZod(context.formData, {
                schema: addMusicSchema,
            });
        },
        lastResult: fetcher.data,
    });

    return (
        <div className="flex flex-col w-full max-w-4xl mt-8 gap-4 px-4">
            {form.errors && (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <Alert.Title>{form.errors}</Alert.Title>
                </Alert>
            )}
            <Card className="p-2">
                <Card.Content className="p-2">
                    <fetcher.Form
                        method="post"
                        action="/api/music/add"
                        className="flex flex-col items-center gap-3"
                        id={form.id}
                        onSubmit={form.onSubmit}
                    >
                        <Input
                            name={fields.url.name}
                            placeholder="https://www.youtube.com/watch?v=..."
                            autoComplete="off"
                        />
                        {fields.url.errors?.[0] && <p className="text-red-500 text-sm">{fields.url.errors[0]}</p>}

                        <Button
                            type="submit"
                            disabled={Object.keys(form.allErrors).length !== 0 || fetcher.state !== "idle"}
                        >
                            {fetcher.state !== "idle" ? (
                                <Loader className="animate-spin" />
                            ) : (
                                <>
                                    <Send />
                                    <p>楽曲をリクエスト</p>
                                </>
                            )}
                        </Button>
                    </fetcher.Form>
                </Card.Content>
            </Card>
            <Table className="overflow-hidden my-4">
                <Table.Header>
                    <Table.Row>
                        <Table.Head>
                            <Badge variant="outline">VIP</Badge> #
                        </Table.Head>
                        <Table.Head>楽曲名</Table.Head>
                        <Table.Head>チャンネル</Table.Head>
                        <Table.Head />
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    <AnimatePresence initial={false}>
                        {0 < musics.length ? (
                            musics.map((music, i) => (
                                <Table.Row
                                    key={music.id}
                                    as={motion.tr}
                                    initial={{ opacity: 0, x: -100 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    layout
                                >
                                    <Table.Cell>
                                        <p className="font-bold">{i + 1}</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <a
                                            className="text-blue-500 dark:text-purple-400 hover:underline block break-all max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px]"
                                            href={`https://www.youtube.com/watch?v=${music.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {music.title}
                                        </a>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <a
                                            className="text-blue-500 dark:text-purple-400 hover:underline block truncate max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px]"
                                            href={`https://www.youtube.com/channel/${music.channelId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {music.channelName}
                                        </a>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {userHash === music.requesterHash && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="ml-auto text-red-500 hover:text-red-600"
                                                disabled={fetcher.state !== "idle"}
                                                onClick={() => {
                                                    const formData = new FormData();
                                                    formData.append(
                                                        "url",
                                                        `https://www.youtube.com/watch?v=${music.id}`
                                                    );
                                                    void fetcher.submit(formData, {
                                                        method: "post",
                                                        action: "/api/music/remove",
                                                    });
                                                }}
                                            >
                                                {fetcher.state !== "idle" ? (
                                                    <Loader className="animate-spin" />
                                                ) : (
                                                    <TrashIcon />
                                                )}
                                            </Button>
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            ))
                        ) : (
                            <Table.Row>
                                <Table.Cell colSpan={5}>
                                    <p className="text-center text-sm text-gray-500">
                                        リクエストされた楽曲はありません
                                    </p>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </AnimatePresence>
                </Table.Body>
            </Table>
        </div>
    );
}
