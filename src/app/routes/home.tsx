import useFormErrors from "@/app/hooks/useFormErrors";
import usePlayingMusic from "@/app/hooks/usePlayingMusic";
import { StatusBadge } from "@/shared/components";
import { watchUrl } from "@/shared/libs/youtube";
import { safeExecuteAsync } from "@/shared/utils/handle";
import { respondWithResult } from "@/shared/utils/httpResponse";
import { err as makeErr } from "@/shared/utils/result";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { Alert } from "@shadcn/alert";
import { createHash } from "crypto";
import { AnimatePresence } from "framer-motion";
import { AlertCircleIcon, Loader, Send } from "lucide-react";
import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { MemoizedMusicTableRow } from "~/components/MusicTableRow";
import { Button } from "~/components/ui/shadcn/button";
import { Card } from "~/components/ui/shadcn/card";
import { Input } from "~/components/ui/shadcn/input";
import { Table } from "~/components/ui/shadcn/table";
import type { action as actionMusicAdd } from "~/routes/api/music.add";
import { loginSession } from "~/sessions.server";
import { useMusicStore } from "~/stores/musicStore";
import { useAdminStore } from "../../shared/stores/adminStore";

const youtubeUrlSchema = z
  .string({ required_error: "URLの入力は必須です" })
  .url("有効なURLを入力してください")
  .refine(
    (url) =>
      /^https:\/\/www\.youtube\.com\/watch\?v=./.test(url) ||
      /^https:\/\/youtu\.be\//.test(url),
    {
      message: "有効なYouTubeのURLではありません",
    },
  );

const addMusicSchema = z.object({
  url: youtubeUrlSchema,
});

export const meta = () => [
  { title: "楽曲リクエストフォーム" },
  {
    name: "description",
    content: "浜松キャンパスの楽曲リクエストフォームです。",
  },
];

export const loader = async ({ request }: ActionFunctionArgs) => {
  const res = await safeExecuteAsync(async () => {
    const session = await loginSession.getSession(
      request.headers.get("Cookie"),
    );
    const user = session.get("user");

    return {
      userHash: user
        ? createHash("sha256").update(user.id).digest("hex")
        : undefined,
    };
  });

  if (!res.ok) {
    const errVal = res.error as unknown;
    let message = "loader error";
    let code: string | undefined = undefined;
    if (
      errVal &&
      typeof errVal === "object" &&
      "message" in (errVal as Record<string, unknown>)
    ) {
      const m = (errVal as Record<string, unknown>).message;
      if (typeof m === "string") message = m;
    }
    if (
      errVal &&
      typeof errVal === "object" &&
      "code" in (errVal as Record<string, unknown>)
    ) {
      const c = (errVal as Record<string, unknown>).code;
      if (typeof c === "string") code = c;
    }
    return respondWithResult(makeErr({ message, code }));
  }
  return res.value;
};

export default function Home() {
  const { userHash } = useLoaderData<typeof loader>();

  const musics = useMusicStore((state) => state.musics);
  const remoteStatus = useMusicStore((state) => state.remoteStatus);
  const playingMusic = usePlayingMusic(musics, remoteStatus);
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const fetcher = useFetcher<typeof actionMusicAdd>();
  const [form, fields] = useForm({
    shouldValidate: "onInput",
    onValidate(context) {
      return parseWithZod(context.formData, {
        schema: addMusicSchema,
      });
    },
  });

  const { formErrorsString, parsedAction } = useFormErrors(fetcher.data);
  useEffect(() => {
    if (!parsedAction) return;
    void (async () => {
      try {
        const mod = await import("@/shared/utils/uiActionExecutor");
        try {
          mod.executeUiAction(parsedAction, {
            conformFields: fields as unknown as Record<string, unknown>,
          });
        } catch (err) {
          if (import.meta.env.DEV)
            console.debug("uiActionExecutor.executeUiAction failed", err);
        }
      } catch (err) {
        if (import.meta.env.DEV)
          console.debug("dynamic import uiActionExecutor failed", err);
      }
    })();
  }, [parsedAction, fields]);

  return (
    <div className="flex flex-col w-full max-w-4xl mt-8 gap-4 px-4">
      {formErrorsString && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <Alert.Title>{formErrorsString}</Alert.Title>
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
            {Array.isArray(fields.url.errors) && fields.url.errors[0] && (
              <p className="text-red-500 text-sm">{fields.url.errors[0]}</p>
            )}

            <Button
              type="submit"
              disabled={
                Object.keys(form.allErrors).length !== 0 ||
                fetcher.state !== "idle"
              }
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
      <div className="w-full mt-2 flex justify-center">
        {remoteStatus && (
          <StatusBadge status={remoteStatus} music={playingMusic} />
        )}
      </div>
      <Table className="overflow-hidden my-4 table-fixed">
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-12 text-center">No.</Table.Head>
            <Table.Head style={{ width: "70%" }}>楽曲名</Table.Head>
            <Table.Head style={{ width: "20%" }}>チャンネル</Table.Head>
            <Table.Head style={{ width: "10%" }} aria-hidden />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <AnimatePresence initial={false}>
            {0 < musics.length ? (
              musics.map((music, i) => (
                <MemoizedMusicTableRow
                  key={music.id}
                  music={music}
                  index={i}
                  userHash={userHash}
                  isAdmin={isAdmin}
                  isDeleting={fetcher.state !== "idle"}
                  onDelete={(id: string, asAdmin?: boolean) => {
                    const formData = new FormData();
                    formData.append("url", watchUrl(id));
                    if (asAdmin) formData.append("isAdmin", "true");
                    void fetcher.submit(formData, {
                      method: "post",
                      action: "/api/music/remove",
                    });
                  }}
                />
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
