import logger from "@/server/logger";
import { AddMusicSchema } from "@/shared/schemas/music";
import type { ServerContext } from "@/shared/types/server";
import { safeExecuteAsync } from "@/shared/utils/handle";
import { parseWithZod } from "@conform-to/zod";
import { hash } from "crypto";
import type { SubmissionResult } from "node_modules/@conform-to/dom/dist/submission";
import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { loginSession } from "../../sessions.server";

export const action = async ({
  request,
  context,
}: ActionFunctionArgs<ServerContext>): Promise<Response | SubmissionResult> => {
  const submission = parseWithZod(await request.formData(), {
    schema: AddMusicSchema,
  });

  if (submission.status !== "success") return submission.reply();

  const session = await loginSession.getSession(request.headers.get("Cookie"));
  const user = session.get("user");
  const result = await safeExecuteAsync(async () => {
    const maybe = context.io.addMusic(
      submission.value.url,
      user ? hash("sha256", user.id) : undefined,
    );
    const isThenable = (v: unknown): v is Promise<unknown> =>
      !!v &&
      (typeof v === "object" || typeof v === "function") &&
      typeof (v as { then?: unknown }).then === "function";
    if (isThenable(maybe)) return await maybe;
    return maybe;
  });

  if (result.ok) {
    logger.info("addMusic result", { result: result.value });
    return redirect("/");
  }

  logger.error("楽曲追加エラー", { error: result.error });
  return submission.reply({
    formErrors: ["楽曲の追加に失敗しました。後ほど再度お試しください。"],
  });
};

export default function MusicAdd() {
  // このルートはアクション専用のため UI をレンダリングしません
  return null;
}
