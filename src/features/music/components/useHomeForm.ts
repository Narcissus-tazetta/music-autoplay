import convert from "convert-iso8601-duration";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { extractYoutubeId } from "../../../shared/libs/youtube";
import { useAdminStore } from "../../../shared/stores/adminStore";
import { getSocket } from "@/app/lib/socketClient";
import { useMusicStore } from "@/app/stores/musicStore";
import { extractErrorMessage } from "../../../shared/utils/formatError";

interface Inputs {
  url: string;
}

export const useHomeForm = () => {
  const musics = useMusicStore((store) => store.musics);
  const error = useMusicStore((store) => store.error);
  const setAdminStatusCallback = useCallback((v: boolean) => {
    useAdminStore.getState().setIsAdmin(v);
  }, []);

  type Asset = {
    title: string;
    thumbnail: string;
    // ISO8601 duration string (e.g. PT4M13S)
    length: string;
    isMusic: boolean;
    channelId: string;
    channelName: string;
    id: string;
  };

  const parseIsoDuration = (v: unknown): number | null => {
    if (typeof v !== "string") return null;
    try {
      // convert(...) may return a number-like value; coerce and validate
      const n = Number(convert(v));
      if (!Number.isFinite(n)) return null;
      // round to integer seconds
      return Math.max(0, Math.floor(n));
    } catch (e: unknown) {
      void e;
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

  // Guard a socket result shape that may contain { success: boolean, error?: string }
  const isSuccessError = (
    v: unknown,
  ): v is { success: boolean; error?: string } => {
    if (typeof v !== "object" || v === null) return false;
    const rec = v as Record<string, unknown>;
    if (typeof rec.success !== "boolean") return false;
    if (rec.error !== undefined && typeof rec.error !== "string") return false;
    return true;
  };

  const addMusicCallback = useCallback((m: Asset) => {
    // Map Asset -> Music (store expects `duration` as a number of seconds)
    const duration = parseIsoDuration(m.length) ?? 0;
    useMusicStore.getState().addMusic({
      title: m.title,
      channelName: m.channelName,
      channelId: m.channelId,
      id: m.id,
      duration: String(duration),
    });
  }, []);

  const resetErrorCallback = useCallback(() => {
    const fn = useMusicStore.getState().resetError;
    if (typeof fn === "function") fn();
  }, []);

  const [showAlert, setShowAlert] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | undefined>(
    undefined,
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const adminParam = urlParams.get("admin");

      if (adminParam) {
        getSocket().emit("adminAuthByQuery", adminParam, (result: unknown) => {
          if (isSuccessError(result) && result.success) {
            setAdminStatusCallback(true);
            setSuccessMessage("URL経由で管理者認証に成功しました");
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("admin");
            window.history.replaceState({}, "", newUrl.toString());
          } else {
            const err =
              isSuccessError(result) && result.error ? result.error : undefined;
            console.warn("URL管理者認証に失敗:", err);
          }
        });
      }
    }
  }, [setAdminStatusCallback]);

  const handleCloseAlert = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowAlert(false);
      setIsAnimating(false);
      clearErrors("url");
      resetErrorCallback();
      setSuccessMessage(undefined);
    }, 200);
  }, [clearErrors, resetErrorCallback]);

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
      return () => {
        clearTimeout(timer);
      };
    }
  }, [errors.url, error, handleCloseAlert]);

  useEffect(() => {
    if (successMessage) {
      setShowAlert(true);
      setIsAnimating(false);
      const timer = setTimeout(() => {
        handleCloseSuccessAlert();
      }, 5000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [successMessage, handleCloseSuccessAlert]);

  const onSubmit = async (data: Inputs) => {
    const url = data.url.trim();

    if (url.length >= 32 && !/^https?:\/\//.test(url)) {
      getSocket().emit("adminAuth", url, (result: unknown) => {
        if (isSuccessError(result) && result.success) {
          setAdminStatusCallback(true);
          setSuccessMessage("管理者認証に成功しました");
        } else {
          const err =
            isSuccessError(result) && result.error
              ? result.error
              : "管理者認証に失敗しました";
          setError("url", {
            type: "manual",
            message: err,
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
    const videoId = extractYoutubeId(url);
    if (videoId === null) {
      setError("url", {
        type: "onChange",
        message:
          "有効なYouTubeのURLを入力してください（例：https://www.youtube.com/watch?v=...）",
      });
      return;
    }
    const formData = new FormData();
    formData.append("videoId", videoId);
    let assets: Asset | null = null;
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        let errorMessage = text || "動画情報の取得に失敗しました";
        if (res.status === 429)
          errorMessage =
            "リクエストが多すぎます。しばらくしてからもう一度お試しください。";
        setError("url", { type: "manual", message: errorMessage });
        return;
      }

      const parsed: unknown = await res.json().catch(() => null);
      if (!isAsset(parsed)) {
        setError("url", {
          type: "manual",
          message: "サーバーから不正なデータが返却されました",
        });
        return;
      }
      assets = parsed;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "サーバーとの通信に失敗しました";
      setError("url", {
        type: "manual",
        message: msg,
      });
      return;
    }

    if (convert(assets.length) > 60 * 20) {
      setError("url", {
        type: "onChange",
        message: "20分以上の動画は登録できません",
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
    addMusicCallback(assets);
    setSuccessMessage(`「${assets.title}」を追加しました！`);
    resetField("url");
  };

  const uiErrorMessage = (() => {
    const fieldMsg = errors.url?.message;
    // sometimes the field message can be just the field key ('url'); if so prefer formatted store error
    if (
      typeof fieldMsg === "string" &&
      fieldMsg.length > 0 &&
      fieldMsg !== "url"
    )
      return fieldMsg;
    const extracted = extractErrorMessage(error, { joinWith: " " });
    if (extracted) return extracted;
    return typeof fieldMsg === "string" ? fieldMsg : undefined;
  })();
  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    showAlert,
    isAnimating,
    successMessage,
    errorMessage: uiErrorMessage,
    handleCloseAlert,
    handleCloseSuccessAlert,
    resetError: resetErrorCallback,
  };
};
