import { useMusicStore } from "@/app/stores/musicStore";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { useAdminAuth } from "./useAdminAuth";
import { useAssetValidation } from "./useAssetValidation";
import { useFormAlerts } from "./useFormAlerts";

interface Inputs {
  url: string;
}

export const useFormSubmission = () => {
  const { authenticateByKey } = useAdminAuth();
  const { validateYouTubeUrl, fetchAsset, validateAsset } =
    useAssetValidation();
  const { showSuccess } = useFormAlerts();

  const musics = useMusicStore((store) => store.musics);
  const addMusic = useCallback(
    (asset: {
      title: string;
      channelName: string;
      channelId: string;
      id: string;
      duration: string;
    }) => {
      useMusicStore.getState().addMusic(asset);
    },
    [],
  );

  const form = useForm<Inputs>();
  const {
    register,
    handleSubmit,
    resetField,
    setError,
    clearErrors,
    formState: { errors },
  } = form;

  const onSubmit = useCallback(
    async (data: Inputs) => {
      const url = data.url.trim();

      if (url.length >= 32 && !/^https?:\/\//.test(url)) {
        try {
          const result = await authenticateByKey(url);
          if (result.success && result.message) showSuccess(result.message);
          else if (result.message)
            setError("url", { type: "manual", message: result.message });
        } catch {
          setError("url", {
            type: "manual",
            message: "管理者認証に失敗しました",
          });
        }
        resetField("url");
        return;
      }

      if (musics.length >= 50) {
        setError("url", {
          type: "manual",
          message: "これ以上は送信できません。リストは50件までです。",
        });
        return;
      }

      try {
        const videoId = validateYouTubeUrl(url);
        const asset = await fetchAsset(videoId);
        validateAsset(asset);

        const duration = asset.length
          ? String(Math.floor(Number(asset.length)))
          : "0";
        addMusic({
          title: asset.title,
          channelName: asset.channelName,
          channelId: asset.channelId,
          id: asset.id,
          duration,
        });

        showSuccess(`「${asset.title}」を追加しました！`);
        resetField("url");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "サーバーとの通信に失敗しました";
        setError("url", { type: "manual", message });
      }
    },
    [
      musics.length,
      authenticateByKey,
      validateYouTubeUrl,
      fetchAsset,
      validateAsset,
      addMusic,
      showSuccess,
      setError,
      resetField,
    ],
  );

  return {
    form,
    register,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    clearErrors,
  };
};
