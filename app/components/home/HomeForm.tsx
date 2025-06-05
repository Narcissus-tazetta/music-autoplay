// 移動元: ../HomeForm.tsx
import React from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useMusicStore } from "~/stores/musicStore";
import { parseYoutubeUrl, YOUTUBE_PATTERN } from "~/libs/utils";
import convert from "convert-iso8601-duration";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SendIcon } from "lucide-react";

interface HomeFormProps {
  mode: "dark" | "light";
}

interface Inputs {
  url: string;
}

export const HomeForm: React.FC<HomeFormProps> = ({ mode }) => {
  const musics = useMusicStore((store) => store.musics);
  const error = useMusicStore((store) => store.error);

  const {
    register,
    handleSubmit,
    resetField,
    setError,
    formState: { errors },
  } = useForm<Inputs>();

  // フォーム送信処理
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    if (musics.length >= 50) {
      setError("url", {
        type: "manual",
        message: "これ以上は送信できません。リストは50件までです。",
      });
      return;
    }

    const url = data.url;
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

    let assets: any = null;
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
    } catch (e) {
      setError("url", {
        type: "manual",
        message: "サーバーとの通信に失敗しました",
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

    useMusicStore.getState().addMusic({ url, title: assets.title, thumbnail: assets.thumbnail });
    resetField("url");
  };

  return (
    <form className="flex flex-col items-center gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="w-full flex flex-col items-center">
        <Input
          className="w-[500px]"
          {...register("url", {
            required: "URLを入力してください",
            pattern: {
              value: YOUTUBE_PATTERN,
              message: "有効なYouTubeのURLを入力してください"
            },
            onChange() {
              useMusicStore.getState().resetError();
            },
          })}
          autoComplete="off"
          placeholder="例：https://www.youtube.com/watch?v=..."
          aria-label="YouTubeのURL"
        />
        <p className="text-red-500 text-sm">{error}</p>
        {errors.url && <p className="text-red-500 text-sm">{errors.url?.message}</p>}
      </div>
      <Button
        type="submit"
        className="flex w-xs gap-2"
        style={{
          background: mode === "dark" ? "#E8EAED" : "#212225",
          color: mode === "dark" ? "#212225" : "#fff",
          border: "none"
        }}
      >
        <SendIcon size={12} />
        <p>送信</p>
      </Button>
    </form>
  );
};
