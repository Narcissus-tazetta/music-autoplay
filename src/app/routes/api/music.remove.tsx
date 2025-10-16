import { container } from "@/server/di/container";
import logger from "@/server/logger";
import { RemoveMusicSchema } from "@/shared/schemas/music";
import type { ServerContext } from "@/shared/types/server";
import { safeExecuteAsync } from "@/shared/utils/errorUtils";
import { respondWithResult } from "@/shared/utils/httpResponse";
import { err as makeErr } from "@/shared/utils/result";
import { parseWithZod } from "@conform-to/zod";
import { createHash } from "crypto";
import type { ActionFunctionArgs } from "react-router";
import { SERVER_ENV } from "../../env.server";
import { loginSession } from "../../sessions.server";

export const action = async ({
  request,
  context,
}: ActionFunctionArgs<ServerContext>) => {
  const formData = await request.formData();
  const submission = parseWithZod(formData, {
    schema: RemoveMusicSchema,
  });

  if (submission.status !== "success")
    return Response.json(submission.reply(), { status: 400 });

  const session = await loginSession.getSession(request.headers.get("Cookie"));
  const user = session.get("user") as { id?: string } | undefined;
  const isAdminRequest = formData.get("isAdmin") === "true";

  logger.info("Debug remove request", {
    hasUser: Boolean(user?.id),
    userId: user?.id,
    isAdminRequest,
  });
  if (!isAdminRequest && !user?.id) {
    return respondWithResult(
      makeErr({
        message: "ログインしていないため、楽曲を削除できません",
        code: "unauthorized",
      }),
    );
  }

  try {
    let requesterHash: string;

    if (isAdminRequest) {
      const cfg = container.getOptional("configService") as
        | { getString?(key: string): string }
        | undefined;
      let adminSecret: string | undefined;
      try {
        adminSecret =
          cfg?.getString?.("ADMIN_SECRET") ?? SERVER_ENV.ADMIN_SECRET;
      } catch {
        adminSecret = SERVER_ENV.ADMIN_SECRET;
      }
      if (!adminSecret) {
        logger.warn(
          "Admin deletion requested but ADMIN_SECRET is not configured",
        );
        return respondWithResult(makeErr({ message: "unauthorized" }));
      }
      requesterHash = createHash("sha256").update(adminSecret).digest("hex");
      logger.info("Using admin hash for deletion");
    } else {
      if (!user?.id) {
        return respondWithResult(
          makeErr({
            message: "ユーザーIDが見つかりません",
            code: "unauthorized",
          }),
        );
      }
      requesterHash = createHash("sha256").update(user.id).digest("hex");
      logger.info("Using user hash for deletion");
    }

    const result = await safeExecuteAsync(async () => {
      return await Promise.resolve(
        context.io.removeMusic(submission.value.url, requesterHash),
      );
    });

    if (!result.ok) {
      logger.error("楽曲削除エラー", { error: result.error });
      const errVal = result.error;
      let msg = "Unknown error";
      if (typeof errVal === "string") msg = errVal;
      else if (
        errVal &&
        typeof errVal === "object" &&
        "message" in (errVal as Record<string, unknown>)
      ) {
        const m = (errVal as Record<string, unknown>).message;
        if (typeof m === "string") msg = m;
      } else {
        try {
          msg = JSON.stringify(errVal);
        } catch {
          msg = Object.prototype.toString.call(errVal);
        }
      }
      return respondWithResult(makeErr({ message: msg }));
    }

    const value = result.value;
    if (typeof value === "object" && value != null) {
      const rec = value as Record<string, unknown>;
      const fe = rec.formErrors;
      if (Array.isArray(fe) && fe.length > 0)
        return Response.json(
          { success: false, error: (fe as string[]).join(" ") },
          { status: 403 },
        );
    }

    return Response.json({ success: true, data: value });
  } catch (error: unknown) {
    logger.error("楽曲削除エラー", { error });
    return Response.json(
      { success: false, error: "楽曲の削除に失敗しました" },
      { status: 500 },
    );
  }
};

export default function MusicRemove() {
  return null; // このルートはアクション専用のため UI をレンダリングしません
}
