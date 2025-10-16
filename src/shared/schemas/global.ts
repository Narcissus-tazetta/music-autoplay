import { z } from "zod";

export const WindowExtensionsSchema = z
  .object({
    SOCKET_URL: z.string().optional(),
    SOCKET_PATH: z.string().optional(),
    __app__: z
      .object({
        navigate: z.function().args(z.string()).returns(z.void()).optional(),
        showToast: z
          .function()
          .args(
            z.object({
              level: z.string(),
              message: z.string(),
            }),
          )
          .returns(z.void())
          .optional(),
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
  return result.success && typeof result.data.structuredClone === "function";
}

export function getWindowExtensions() {
  if (typeof window === "undefined") return null;
  return WindowExtensionsSchema.safeParse(window);
}

export type WindowExtensions = z.infer<typeof WindowExtensionsSchema>;
