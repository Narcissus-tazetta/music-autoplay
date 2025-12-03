import { z } from 'zod';

export const YouTubeId = z
    .string()
    .min(11)
    .max(20)
    .refine(s => /^[A-Za-z0-9_-]+$/.test(s), 'Invalid YouTube id');

export const AddMusicSchema = z.object({
    url: z
        .string({ required_error: 'URLを入力してください' })
        .min(1, 'URLを入力してください')
        .url('有効なURLを入力してください')
        .refine(u => /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(u), {
            message: '有効なYouTubeのURLではありません',
        }),
    requesterHash: z.string().optional(),
    requesterName: z.string().optional(),
});

export const RemoveMusicSchema = z.object({
    url: z.string().url(),
    requesterHash: z.string().optional(),
    isAdmin: z.union([z.literal('true'), z.literal('false')]).optional(),
});

export const YouTubeMetaSchema = z.object({
    id: z.string(),
    title: z.string(),
    channelId: z.string(),
    channelTitle: z.string(),
    duration: z.string().optional(),
    isAgeRestricted: z.boolean().optional(),
});

export const MusicSchema = z.object({
    id: YouTubeId,
    title: z.string().min(1),
    channelName: z.string(),
    channelId: z.string(),
    duration: z.string(),
    requesterHash: z.string().optional(),
    requesterName: z.string().optional(),
    requestedAt: z.string().optional(),
});

export const YouTubeResolveResultSchema = z.discriminatedUnion('ok', [
    z.object({
        ok: z.literal(true),
        value: YouTubeMetaSchema,
    }),
    z.object({
        ok: z.literal(false),
        error: z.union([z.string(), z.instanceof(Error)]),
    }),
]);

export type AddMusicInput = z.infer<typeof AddMusicSchema>;
export type RemoveMusicInput = z.infer<typeof RemoveMusicSchema>;
export type YouTubeMeta = z.infer<typeof YouTubeMetaSchema>;
export type Music = z.infer<typeof MusicSchema>;
export type YouTubeResolveResult = z.infer<typeof YouTubeResolveResultSchema>;
