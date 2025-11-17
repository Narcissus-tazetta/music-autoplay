import logger from "@/server/logger";
import { getMessage } from "@/shared/constants/messages";
import { AddMusicSchema } from "@/shared/schemas/music";
import type { ServerContext } from "@/shared/types/server";
import { safeExecuteAsync } from "@/shared/utils/errors";
import { parseWithZod } from "@conform-to/zod";
import { hash } from "crypto";
import type { SubmissionResult } from "node_modules/@conform-to/dom/dist/submission";
import type { ActionFunctionArgs } from "react-router";
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
  const requesterHash = user ? hash("sha256", user.id) : undefined;
  const requesterName = user?.name ?? (user ? "unknown" : "guest");

  const result = await safeExecuteAsync(async () => {
    const maybe = context.io.addMusic(
      submission.value.url,
      requesterHash,
      requesterName,
    );
    const isThenable = (v: unknown): v is Promise<unknown> =>
      !!v &&
      (typeof v === "object" || typeof v === "function") &&
      typeof (v as { then?: unknown }).then === "function";
    if (isThenable(maybe)) return await maybe;
    return maybe;
  });

  if (result.ok) {
    const resultValue = result.value;
    if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      resultValue &&
      typeof resultValue === "object" &&
      "formErrors" in resultValue
    ) {
      const errors = (resultValue as { formErrors: unknown }).formErrors;
      if (Array.isArray(errors) && errors.length > 0) {
        logger.info("addMusic result", { result: resultValue });
        return submission.reply({
          formErrors: errors,
        });
      }
    }
    return submission.reply({
      resetForm: true,
    });
  }

  logger.error("楽曲追加エラー", { error: result.error });
  return submission.reply({
    formErrors: [getMessage("ERROR_ADD_FAILED")],
  });
};

export default function MusicAdd() {
  // このルートはアクション専用のため UI をレンダリングしません
  return null;
}
