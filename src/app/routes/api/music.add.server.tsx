import type { ServerContext } from "@/shared/types/server";
import { parseWithZod } from "@conform-to/zod";
import { hash } from "crypto";
import type { SubmissionResult } from "node_modules/@conform-to/dom/dist/submission";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { loginSession } from "~/sessions.server";
import { YOUTUBE_PATTERN } from "@/shared/libs/youtube";

const addMusicSchema = z.object({
  url: z
    .string({ required_error: "URLの入力は必須です" })
    .url("有効なURLを入力してください")
    .refine((url) => YOUTUBE_PATTERN.test(url), {
      message: "有効なYouTubeのURLではありません",
    }),
});

export const action = async ({
  request,
  context,
}: ActionFunctionArgs<ServerContext>): Promise<SubmissionResult> => {
  const submission = parseWithZod(await request.formData(), {
    schema: addMusicSchema,
  });

  if (submission.status !== "success") return submission.reply();

  const session = await loginSession.getSession(request.headers.get("Cookie"));
  const user = session.get("user");

  try {
    const result = await context.io.addMusic(
      submission.value.url,
      user ? hash("sha256", user.id) : undefined,
    );
    console.log(result);

    return submission.reply(result);
  } catch (error) {
    console.error("楽曲追加エラー:", error);
    return submission.reply({
      formErrors: ["楽曲の追加に失敗しました。後ほど再度お試しください。"],
    });
  }
};
