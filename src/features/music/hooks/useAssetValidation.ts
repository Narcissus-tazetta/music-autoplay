import { useApiResponseHandler } from "@/shared/hooks/useApiErrorHandler";
import convert from "convert-iso8601-duration";
import { useCallback } from "react";
import { extractYoutubeId } from "../../../shared/libs/youtube";

interface Asset {
  title: string;
  thumbnail: string;
  length: string;
  isMusic: boolean;
  channelId: string;
  channelName: string;
  id: string;
}

const parseIsoDuration = (v: unknown): number | null => {
  if (typeof v !== "string") return null;
  try {
    const n = convert(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
  } catch (e: unknown) {
    if (import.meta.env.DEV) console.debug("parseIsoDuration failed", e);
    return null;
  }
};

const isAsset = (v: unknown): v is Asset => {
  if (!v || typeof v !== "object") return false;
  const rec = v as Record<string, unknown>;
  const duration = parseIsoDuration(rec.length);
  return (
    typeof rec.title === "string" &&
    typeof rec.thumbnail === "string" &&
    duration !== null &&
    typeof rec.isMusic === "boolean" &&
    typeof rec.channelId === "string" &&
    typeof rec.channelName === "string" &&
    typeof rec.id === "string"
  );
};

export const useAssetValidation = () => {
  const handleApiResponse = useApiResponseHandler();

  const validateYouTubeUrl = useCallback((url: string) => {
    const videoId = extractYoutubeId(url);
    if (videoId === null) {
      throw new Error(
        "有効なYouTubeのURLを入力してください（例：https://www.youtube.com/watch?v=...）",
      );
    }
    return videoId;
  }, []);

  const fetchAsset = useCallback(
    async (videoId: string): Promise<Asset> => {
      const formData = new FormData();
      formData.append("videoId", videoId);

      const response = await fetch("/api/assets", {
        method: "POST",
        body: formData,
      });
      const data = await handleApiResponse<Asset>(response);

      if (!isAsset(data))
        throw new Error("サーバーから不正なデータが返却されました");

      return data;
    },
    [handleApiResponse],
  );

  const validateAsset = useCallback((asset: Asset) => {
    if (convert(asset.length) > 60 * 20)
      throw new Error("20分以上の動画は登録できません");
    if (!asset.isMusic) throw new Error("音楽以外の動画は登録できません");
  }, []);

  return {
    validateYouTubeUrl,
    fetchAsset,
    validateAsset,
  };
};
