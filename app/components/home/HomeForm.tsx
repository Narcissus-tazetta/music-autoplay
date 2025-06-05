// 移動元: ../HomeForm.tsx
import React from "react";

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
      if (!res.ok) { /* ... */ }
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
    </form>
  );
};
