import { google } from "googleapis";
import type { Route } from "./+types/assets";
import { keywords } from "./keywords";

export const action = async ({ request }: Route.ActionArgs) => {
    const formData = await request.formData();
    const videoId = formData.get("videoId");

    if (videoId === null || typeof videoId !== "string") {
        return new Response("Invalid request", { status: 400 });
    }

    const res = await google
        .youtube({
            version: "v3",
            auth: process.env.YOUTUBE_API_KEY,
        })
        .videos.list({
            id: [videoId],
            part: ["snippet", "contentDetails"],
        });

    const item = res.data.items?.[0];
    const snippet = item?.snippet;
    const title = snippet?.title || "";
    const description = snippet?.description || "";
    const channelTitle = snippet?.channelTitle || "";
    const thumbnail = snippet?.thumbnails?.high?.url;
    const length = item?.contentDetails?.duration;
    // 年齢制限判定（他のバリデーションと同じ流れで統一）
    const ytRating = item?.contentDetails?.contentRating?.ytRating;
    const isAgeRestricted = ytRating === "ytAgeRestricted";

    if (!title || !thumbnail || !length) {
        return new Response("Invalid video ID", { status: 400 });
    }
    if (isAgeRestricted) {
        return new Response("年齢制限付き動画は登録できません", { status: 400 });
    }
    const lower = (s: string) => s.toLowerCase();
    const text = `${title} ${description} ${channelTitle}`.toLowerCase();
    const hasKeyword = keywords.some((kw) => text.includes(kw.toLowerCase()));
    const isMusic = snippet?.categoryId === "10" || hasKeyword;



    return { title, thumbnail, length, isMusic };
};
