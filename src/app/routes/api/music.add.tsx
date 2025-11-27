import logger from "@/server/logger";
import { getClientIP } from "@/server/utils/getClientIP";
import { getMessage } from "@/shared/constants/messages";
import { AddMusicSchema } from "@/shared/schemas/music";
import type { ServerContext } from "@/shared/types/server";
import { safeExecuteAsync } from "@/shared/utils/errors";
import { parseWithZod } from "@conform-to/zod";
import { hash } from "crypto";
import type { ActionFunctionArgs } from "react-router";
import { loginSession } from "../../sessions.server";

export const action = async ({
  request,
  context,
}: ActionFunctionArgs<ServerContext>) => {
  const clientIP = getClientIP(request);
  const rateLimiter = context.httpRateLimiter;

  if (!rateLimiter.tryConsume(clientIP)) {
    const oldestAttempt = rateLimiter.getOldestAttempt(clientIP);
    const retryAfter =
      typeof oldestAttempt === "number"
        ? Math.ceil((oldestAttempt + 60000 - Date.now()) / 1000)
        : 60;
    logger.warn("Rate limit exceeded", {
      endpoint: "/api/music/add",
      clientIP,
    });
    return Response.json(
      { error: "レート制限を超えました。しばらくしてから再試行してください。" },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } },
    );
  }

  const submission = parseWithZod(await request.formData(), {
    schema: AddMusicSchema,
  });

  if (submission.status !== "success")
    return Response.json(submission.reply(), { status: 400 });

  const session = await loginSession.getSession(request.headers.get("Cookie"));
  const user = session.get("user");
  const requesterHash = user ? hash("sha256", user.id) : undefined;
  const requesterName = user?.name ?? (user ? "unknown" : "guest");

  const result = await safeExecuteAsync(() =>
    context.io.addMusic(submission.value.url, requesterHash, requesterName),
  );

  if (result.ok) {
    const replyOptions = result.value as { formErrors?: string[] };
    if (replyOptions.formErrors && replyOptions.formErrors.length > 0) {
      logger.info("addMusic validation error", {
        formErrors: replyOptions.formErrors,
      });
      return Response.json(
        submission.reply({ fieldErrors: { url: replyOptions.formErrors } }),
        { status: 400 },
      );
    }
    return Response.json(submission.reply({ resetForm: true }), {
      status: 200,
    });
  }

  logger.error("楽曲追加エラー", { error: result.error });
  return Response.json(
    submission.reply({
      fieldErrors: { url: [getMessage("ERROR_ADD_FAILED")] },
    }),
    { status: 500 },
  );
};

export default function MusicAdd() {
  return null;
}
