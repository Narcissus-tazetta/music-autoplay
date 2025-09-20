import type { ActionFunctionArgs } from "react-router";
import { YouTubeService } from "../../../server/youtubeService";

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const videoId = form.get("videoId");
  if (!videoId || typeof videoId !== "string") {
    return new Response(null, { status: 400 });
  }

  const yt = new YouTubeService();
  const res = await yt.getVideoDetails(videoId);
  if (!res.ok) {
    return new Response(JSON.stringify({ error: res.error }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const meta = res.value;
  let thumbnail = "";
  try {
    const raw = meta.raw;
    if (raw && typeof raw === "object") {
      const snippet = (raw as { snippet?: unknown }).snippet as
        | Record<string, unknown>
        | undefined;
      const thumbs =
        snippet && (snippet.thumbnails as Record<string, unknown> | undefined);
      if (thumbs) {
        const high = thumbs["high"] as Record<string, unknown> | undefined;
        const def = thumbs["default"] as Record<string, unknown> | undefined;
        if (high && typeof high["url"] === "string")
          thumbnail = String(high["url"]);
        else if (def && typeof def["url"] === "string")
          thumbnail = String(def["url"]);
      }
    }
  } catch {
    thumbnail = "";
  }

  const body = {
    title: meta.title,
    thumbnail,
    length: meta.duration,
    isMusic: !meta.isAgeRestricted,
    channelId: meta.channelId,
    channelName: meta.channelTitle,
    id: videoId,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default function Route() {
  return null;
}
