import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useMusicStore } from "~/stores/musicStore";
import { useAdminStore } from "~/stores/adminStore";
import { parseYoutubeUrl } from "~/libs/utils";
import convert from "convert-iso8601-duration";
import { socket } from "~/socket";

interface Inputs {
  url: string;
}

export const useHomeForm = () => {
  const musics = useMusicStore((store) => store.musics);
  const error = useMusicStore((store) => store.error);
  const addMusic = useMusicStore((store) => store.addMusic);
  const resetError = useMusicStore((store) => store.resetError);
  const setAdminStatus = useAdminStore((store) => store.setAdminStatus);

  const [showAlert, setShowAlert] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined);

  const form = useForm<Inputs>();
  const {
    register,
    handleSubmit,
    resetField,
    setError,
    clearErrors,
    formState: { errors },
  } = form;

  const handleCloseAlert = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowAlert(false);
      setIsAnimating(false);
      clearErrors("url");
      resetError();
      setSuccessMessage(undefined);
    }, 200);
  }, [clearErrors, resetError]);

  const handleCloseSuccessAlert = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowAlert(false);
      setIsAnimating(false);
      setSuccessMessage(undefined);
    }, 200);
  }, []);

  useEffect(() => {
    if (errors.url || error) {
      setShowAlert(true);
      setIsAnimating(false);
      setSuccessMessage(undefined);
      const timer = setTimeout(() => {
        handleCloseAlert();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [errors.url, error, handleCloseAlert]);

  useEffect(() => {
    if (successMessage) {
      setShowAlert(true);
      setIsAnimating(false);
      const timer = setTimeout(() => {
        handleCloseSuccessAlert();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, handleCloseSuccessAlert]);

  const onSubmit = async (data: Inputs) => {
    const url = data.url.trim();

    if (url.length >= 32 && !/^https?:\/\//.test(url)) {
      socket.emit("adminAuth", url, (result: { success: boolean; error?: string }) => {
        if (result.success) {
          setAdminStatus(true);
          setSuccessMessage("管理者認証に成功しました");
        } else {
          setError("url", {
            type: "manual",
            message: result.error || "管理者認証に失敗しました",
          });
        }
      });
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
    const videoId = parseYoutubeUrl(url);
    if (videoId === null) {
      setError("url", {
        type: "onChange",
        message: "有効なYouTubeのURLを入力してください（例：https://www.youtube.com/watch?v=...）",
      });
      return;
    }
    const formData = new FormData();
    formData.append("videoId", videoId);
    let assets: {
      title: string;
      thumbnail: string;
      length: string;
      isMusic: boolean;
    } | null = null;
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      if (!res.ok) {
        setError("url", {
          type: "manual",
          message: text || "動画情報の取得に失敗しました",
        });
        return;
      }
      assets = JSON.parse(text);
    } catch {
      setError("url", {
        type: "manual",
        message: "サーバーとの通信に失敗しました",
      });
      return;
    }

    if (!assets) {
      setError("url", {
        type: "manual",
        message: "動画情報の取得に失敗しました",
      });
      return;
    }

    if (convert(assets.length) > 60 * 10) {
      setError("url", {
        type: "onChange",
        message: "10分以上の動画は登録できません",
      });
      return;
    }
    if (!assets.isMusic) {
      setError("url", {
        type: "onChange",
        message: "音楽以外の動画は登録できません",
      });
      return;
    }
    addMusic({ url, title: assets.title, thumbnail: assets.thumbnail });
    setSuccessMessage(`「${assets.title}」を追加しました！`);
    resetField("url");
  };

  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    showAlert,
    isAnimating,
    successMessage,
    errorMessage: errors.url?.message || error || undefined,
    handleCloseAlert,
    handleCloseSuccessAlert,
    resetError,
  };
};
