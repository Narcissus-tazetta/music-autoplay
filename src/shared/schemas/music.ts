import { z } from 'zod';

export const YouTubeId = z
    .string()
    .min(11)
    .max(20)
    .refine(s => /^[A-Za-z0-9_-]+$/.test(s), 'Invalid YouTube id');

export const AddMusicSchema = z.object({
    requesterHash: z.string().optional(),
    requesterName: z.string().optional(),
    url: z
        .string({ message: 'URLを入力してください' })
        .min(1, 'URLを入力してください')
        .url('有効なURLを入力してください')
        .refine(u => /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(u), {
            message: '有効なYouTubeのURLではありません',
        }),
});

export const RemoveMusicSchema = z.object({
    isAdmin: z.union([z.literal('true'), z.literal('false')]).optional(),
    requesterHash: z.string().optional(),
    url: z.string().url(),
});

export const YouTubeMetaSchema = z.object({
    channelId: z.string(),
    channelTitle: z.string(),
    duration: z.string().optional(),
    id: z.string(),
    isAgeRestricted: z.boolean().optional(),
    title: z.string(),
});

export const MusicSchema = z.object({
    channelId: z.string(),
    channelName: z.string(),
    duration: z.string(),
    id: YouTubeId,
    requestedAt: z.string().optional(),
    requesterHash: z.string().optional(),
    requesterName: z.string().optional(),
    title: z.string().min(1),
});

export const YouTubeResolveResultSchema = z.discriminatedUnion('ok', [
    z.object({
        ok: z.literal(true),
        value: YouTubeMetaSchema,
    }),
    z.object({
        error: z.union([z.string(), z.instanceof(Error)]),
        ok: z.literal(false),
    }),
]);

export type AddMusicInput = z.infer<typeof AddMusicSchema>;
export type RemoveMusicInput = z.infer<typeof RemoveMusicSchema>;
export type YouTubeMeta = z.infer<typeof YouTubeMetaSchema>;
export type Music = z.infer<typeof MusicSchema>;
export type YouTubeResolveResult = z.infer<typeof YouTubeResolveResultSchema>;
