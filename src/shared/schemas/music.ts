import { z } from 'zod';

export const YouTubeId = z
    .string()
    .min(11)
    .max(20)
    .refine(s => /^[A-Za-z0-9_-]+$/.test(s), 'Invalid YouTube id');

export const INSERT_AT_FRONT = '__front__';
export const INSERT_AT_END = '__end__';

export const AddMusicSchema = z.object({
    insertAfterId: z.union([YouTubeId, z.literal(INSERT_AT_FRONT), z.literal(INSERT_AT_END)]).optional(),
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

// Anchor-based on purpose: an index computed on the client goes stale the moment another
// user mutates the queue, while "move after song X" stays meaningful under concurrency.
export const ReorderMusicSchema = z.object({
    afterId: z.union([YouTubeId, z.literal(INSERT_AT_FRONT)]),
    id: YouTubeId,
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
export type ReorderMusicInput = z.infer<typeof ReorderMusicSchema>;
export type YouTubeMeta = z.infer<typeof YouTubeMetaSchema>;
export type Music = z.infer<typeof MusicSchema>;
export type YouTubeResolveResult = z.infer<typeof YouTubeResolveResultSchema>;
