import { z } from "zod";

export const YouTubeId = z
    .string()
    .min(11)
    .max(20)
    .refine((s) => /^[A-Za-z0-9_-]+$/.test(s), "Invalid YouTube id");

export const AddMusicSchema = z.object({
    url: z
        .string()
        .url()
        .refine((u) => /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(u), {
            message: "有効なYouTubeのURLではありません",
        }),
    requesterHash: z.string().optional(),
});

export const RemoveMusicSchema = z.object({
    url: z.string().url(),
    isAdmin: z.union([z.literal("true"), z.literal("false")]).optional(),
});

export const YouTubeMetaSchema = z.object({
    id: z.string(),
    title: z.string(),
    channelId: z.string(),
    channelTitle: z.string(),
    duration: z.string().optional(),
    isAgeRestricted: z.boolean().optional(),
});

export type AddMusicInput = z.infer<typeof AddMusicSchema>;
export type RemoveMusicInput = z.infer<typeof RemoveMusicSchema>;
export type YouTubeMeta = z.infer<typeof YouTubeMetaSchema>;

export default {
    AddMusicSchema,
    RemoveMusicSchema,
    YouTubeMetaSchema,
};
