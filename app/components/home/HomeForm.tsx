import { useForm, type SubmitHandler } from "react-hook-form";
import { useMusicStore } from "~/stores/musicStore";
import { parseYoutubeUrl, YOUTUBE_PATTERN } from "~/libs/utils";
import convert from "convert-iso8601-duration";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SendIcon } from "lucide-react";

interface HomeFormProps {
  mode: "dark" | "light";
  onAdminModeChange?: (isAdmin: boolean) => void;
}

interface Inputs {
  url: string;
}

export const HomeForm: React.FC<HomeFormProps> = ({ mode, onAdminModeChange }) => {
  const musics = useMusicStore((store) => store.musics);
  const error = useMusicStore((store) => store.error);
  const addMusic = useMusicStore((store) => store.addMusic);
  const resetError = useMusicStore((store) => store.resetError);

  const {
    register,
    handleSubmit,
    resetField,
    setError,
    formState: { errors },
  } = useForm<Inputs>();

  // フォーム送信処理
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    const url = data.url.trim();
    if (url.toLowerCase() === "admin") {
      if (onAdminModeChange) onAdminModeChange(true);
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
    resetField("url");
  };

  return (
    <form className="flex flex-col items-center gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="w-full flex flex-col items-center">
        <Input
          className="w-[500px]"
          {...register("url", {
            validate: (value) => {
              if (value.trim().toLowerCase() === "admin") return true;
              if (!value) return "URLを入力してください";
              if (!YOUTUBE_PATTERN.test(value)) return "有効なYouTubeのURLを入力してください";
              return true;
            },
            onChange() {
              resetError();
            },
          })}
          autoComplete="off"
          placeholder="例：https://www.youtube.com/watch?v=..."
          aria-label="YouTubeのURL"
        />
        {errors.url && <p className="text-red-500 text-sm">{errors.url?.message}</p>}
        {!errors.url && error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
      <Button
        type="submit"
        className="flex w-xs gap-2"
        style={{
          background: mode === "dark" ? "#E8EAED" : "#212225",
          color: mode === "dark" ? "#212225" : "#fff",
          border: "none",
        }}
      >
        <SendIcon size={12} />
        <p>送信</p>
      </Button>
    </form>
  );
};
