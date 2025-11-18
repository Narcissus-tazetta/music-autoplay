import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { useFetcher } from "react-router";
import { z } from "zod";
import type { action as actionMusicAdd } from "~/routes/api/music.add";

const youtubeUrlSchema = z
  .string({ required_error: "URLの入力は必須です" })
  .url("有効なURLを入力してください")
  .refine(
    (url) =>
      /^https:\/\/www\.youtube\.com\/watch\?v=./.test(url) ||
      /^https:\/\/youtu\.be\//.test(url),
    {
      message: "有効なYouTubeのURLではありません",
    },
  );

const addMusicSchema = z.object({
  url: youtubeUrlSchema,
});

export function useMusicForm() {
  const fetcher = useFetcher<typeof actionMusicAdd>({ key: "add-music" });
  const [form, fields] = useForm({
    lastResult: fetcher.data,
    shouldValidate: "onInput",
    shouldRevalidate: "onInput",
    onValidate(context) {
      return parseWithZod(context.formData, {
        schema: addMusicSchema,
      });
    },
  });

  return {
    fetcher,
    form,
    fields,
    isSubmitting: fetcher.state !== "idle",
    hasErrors: Object.keys(form.allErrors).length !== 0,
  };
}
