import { useMusicStore } from "@/app/stores/musicStore";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { useAdminAuth } from "./useAdminAuth";
import { useAssetValidation } from "./useAssetValidation";
import { useFormAlerts } from "./useFormAlerts";

interface Inputs {
  url: string;
}

export const useFormSubmission = (showError?: (message: string) => void) => {
  const { authenticateByKey } = useAdminAuth();
  const { validateYouTubeUrl } = useAssetValidation();
  const { showSuccess } = useFormAlerts();

  const musics = useMusicStore((store) => store.musics);
  const socket = useMusicStore((store) => store.socket);

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
        const msg = "これ以上は送信できません。リストは50件までです。";
        setError("url", {
          type: "manual",
          message: msg,
        });
        if (showError) showError(msg);
        return;
      }

      if (!socket || !socket.connected) {
        const msg = "サーバーに接続されていません";
        setError("url", {
          type: "manual",
          message: msg,
        });
        if (showError) showError(msg);
        return;
      }

      try {
        validateYouTubeUrl(url);

        await new Promise<void>((resolve, reject) => {
          socket.emit("addMusic", url, undefined, (response) => {
            if (
              response &&
              typeof response === "object" &&
              "formErrors" in response &&
              Array.isArray(response.formErrors)
            ) {
              const errorMsg =
                response.formErrors.join(", ") || "曲の追加に失敗しました";
              reject(new Error(errorMsg));
            } else {
              resolve();
            }
          });
        });

        showSuccess(`曲を追加しました！`);
        resetField("url");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "サーバーとの通信に失敗しました";
        setError("url", { type: "manual", message });
        if (showError) showError(message);
      }
    },
    [
      musics.length,
      socket,
      authenticateByKey,
      validateYouTubeUrl,
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
