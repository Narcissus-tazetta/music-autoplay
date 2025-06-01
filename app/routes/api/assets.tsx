import { google } from "googleapis";
import type { Route } from "./+types/assets";

export const action = async ({ request }: Route.ActionArgs) => {
    const formData = await request.formData();
    const videoId = formData.get("videoId");

    if (videoId === null || typeof videoId !== "string") {
        return new Response("Invalid request", { status: 400 });
    }

    const res = await google
        .youtube({
            version: "v3",
            auth: import.meta.env.VITE_YOUTUBE_API_KEY,
        })
        .videos.list({
            id: [videoId],
            part: ["snippet", "contentDetails"],
        });

    const item = res.data.items?.[0];
    const snippet = item?.snippet;
    const title = snippet?.title;
    const thumbnail = snippet?.thumbnails?.high?.url;
    const length = item?.contentDetails?.duration;
    // 音楽判定キーワード
    const musicKeywords = [
      "music", "音楽", "records", "official", "label", "ミュージック", "mv"
    ];
    // 判定対象文字列を結合
    const textForCheck = [
      snippet?.title,
      snippet?.description,
      snippet?.channelTitle,
    ].filter(Boolean).join(" ").toLowerCase();

    // キーワードが1つでも含まれていればtrue
    const hasMusicKeyword = musicKeywords.some((kw) => textForCheck.includes(kw.toLowerCase()));

    const isMusic = item?.snippet?.categoryId === "10" || hasMusicKeyword;

    if (!title || !thumbnail || !length) {
        return new Response("Invalid video ID", { status: 400 });
    }

    return { title, thumbnail, length, isMusic };
};
