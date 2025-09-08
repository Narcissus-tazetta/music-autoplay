import type { ServerContext } from "@/shared/types/server";
import { parseWithZod } from "@conform-to/zod";
import { hash } from "crypto";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { loginSession } from "~/sessions.server";
import { YOUTUBE_PATTERN } from "@/shared/libs/youtube";

const removeMusicSchema = z.object({
    url: z
        .string({ required_error: "URLの入力は必須です" })
        .url("有効なURLを入力してください")
        .refine((url) => YOUTUBE_PATTERN.test(url), { message: "有効なYouTubeのURLではありません" }),
});

export const action = async ({ request, context }: ActionFunctionArgs<ServerContext>) => {
    const submission = parseWithZod(await request.formData(), { schema: removeMusicSchema });

    if (submission.status !== "success") return Response.json(submission.reply(), { status: 400 });

    const session = await loginSession.getSession(request.headers.get("Cookie"));
    const user = session.get("user");

    if (!user?.id) {
        return Response.json(
            { success: false, error: "ログインしていないため、楽曲を削除できません" },
            { status: 401 }
        );
    }

    try {
        const result = await context.io.removeMusic(submission.value.url, hash("sha256", user.id));
        return Response.json({ success: true, data: result });
    } catch (error) {
        console.error("楽曲削除エラー:", error);
        return Response.json({ success: false, error: "楽曲の削除に失敗しました" }, { status: 500 });
    }
};
