import type { ServerContext } from "@/shared/types/server";
import { parseWithZod } from "@conform-to/zod";
import { hash } from "crypto";
import type { SubmissionResult } from "node_modules/@conform-to/dom/dist/submission";
import type { ActionFunctionArgs } from "react-router";
import { loginSession } from "../../sessions.server";
import logger from "@/server/logger";
import { AddMusicSchema } from "@/shared/schemas/music";

export const action = async ({ request, context }: ActionFunctionArgs<ServerContext>): Promise<SubmissionResult> => {
    const submission = parseWithZod(await request.formData(), {
        schema: AddMusicSchema,
    });

    if (submission.status !== "success") return submission.reply();

    const session = await loginSession.getSession(request.headers.get("Cookie"));
    const user = session.get("user");

    try {
        const result = await context.io.addMusic(submission.value.url, user ? hash("sha256", user.id) : undefined);
        logger.info("addMusic result", { result });

        return submission.reply(result);
    } catch (error) {
        logger.error("楽曲追加エラー", { error });
        return submission.reply({
            formErrors: ["楽曲の追加に失敗しました。後ほど再度お試しください。"],
        });
    }
};

// Client-side component (optional, for API routes)
export default function MusicAdd() {
    return null; // This route is action-only
}
