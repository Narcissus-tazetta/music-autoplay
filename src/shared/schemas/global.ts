import { z } from 'zod';

const UiToastLevelSchema = z.enum(['info', 'success', 'warning', 'error']);

const NavigateFnSchema = z.custom<(to: string) => void>(
    v => typeof v === 'function',
);
const ShowToastFnSchema = z.custom<
    (payload: { level: z.infer<typeof UiToastLevelSchema>; message: string }) => void
>(v => typeof v === 'function');

export const WindowExtensionsSchema = z
    .object({
        SOCKET_PATH: z.string().optional(),
        SOCKET_URL: z.string().optional(),
        __app__: z
            .object({
                navigate: NavigateFnSchema.optional(),
                showToast: ShowToastFnSchema.optional(),
            })
            .optional(),
    })
    .passthrough();

export const GlobalThisSchema = z
    .object({
        structuredClone: z.function().optional(),
    })
    .passthrough();

export function hasStructuredClone(
    global: unknown,
): global is { structuredClone: (x: unknown) => unknown } {
    const result = GlobalThisSchema.safeParse(global);
    return result.success && typeof result.data.structuredClone === 'function';
}

export const getWindowExtensions = ():
    | ReturnType<typeof WindowExtensionsSchema.safeParse>
    | null => {
    if (typeof window === 'undefined') return null;
    return WindowExtensionsSchema.safeParse(window);
};

export type WindowExtensions = z.infer<typeof WindowExtensionsSchema>;
