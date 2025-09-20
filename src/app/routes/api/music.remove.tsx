import type { ServerContext } from "@/shared/types/server";
import { parseWithZod } from "@conform-to/zod";
import { createHash } from "crypto";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { loginSession } from "../../sessions.server";
import { SERVER_ENV } from "../../env.server";
import logger from "@/server/logger";
import { YOUTUBE_PATTERN } from "@/shared/libs/youtube";

const removeMusicSchema = z.object({
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
}: ActionFunctionArgs<ServerContext>) => {
  const formData = await request.formData();
  const submission = parseWithZod(formData, {
    schema: removeMusicSchema,
  });

  if (submission.status !== "success")
    return Response.json(submission.reply(), { status: 400 });

  const session = await loginSession.getSession(request.headers.get("Cookie"));
  const user = session.get("user");
  const isAdminRequest = formData.get("isAdmin") === "true";

  logger.info("Debug remove request", {
    hasUser: Boolean(user?.id),
    userId: user?.id,
    isAdminRequest,
  });
  if (!isAdminRequest && !user?.id) {
    return Response.json(
      { success: false, error: "ログインしていないため、楽曲を削除できません" },
      { status: 401 },
    );
  }

  try {
    let requesterHash: string;

    if (isAdminRequest) {
      requesterHash = createHash("sha256")
        .update(String(SERVER_ENV.ADMIN_SECRET))
        .digest("hex");
      logger.info("Using admin hash for deletion");
    } else {
      if (!user?.id) {
        return Response.json(
          { success: false, error: "ユーザーIDが見つかりません" },
          { status: 401 },
        );
      }
      requesterHash = createHash("sha256")
        .update(String(user.id))
        .digest("hex");
      logger.info("Using user hash for deletion");
    }

    const maybe = context.io.removeMusic(
      submission.value.url,
      requesterHash,
    ) as unknown;
    let result: unknown;
    if (maybe && typeof (maybe as { then?: unknown }).then === "function") {
      result = await (maybe as Promise<unknown>);
    } else {
      result = maybe;
    }

    if (
      result &&
      typeof result === "object" &&
      "formErrors" in (result as Record<string, unknown>)
    ) {
      const r = result as { formErrors?: unknown };
      if (Array.isArray(r.formErrors)) {
        return Response.json(
          { success: false, error: r.formErrors.join(" ") },
          { status: 403 },
        );
      }
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    logger.error("楽曲削除エラー", { error });
    return Response.json(
      { success: false, error: "楽曲の削除に失敗しました" },
      { status: 500 },
    );
  }
};

export default function MusicRemove() {
  return null; // This route is action-only
}
