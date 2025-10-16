import { z } from "zod";

export const LoggerModuleSchema = z.object({
  default: z
    .object({
      warn: z
        .function()
        .args(z.string(), z.unknown().optional())
        .returns(z.void()),
      debug: z
        .function()
        .args(z.string(), z.unknown().optional())
        .returns(z.void()),
      info: z
        .function()
        .args(z.string(), z.unknown().optional())
        .returns(z.void()),
      error: z
        .function()
        .args(z.string(), z.unknown().optional())
        .returns(z.void()),
    })
    .passthrough(),
});

export type LoggerModule = z.infer<typeof LoggerModuleSchema>;

export async function importLogger(): Promise<LoggerModule["default"] | null> {
  try {
    const module = await import("@/server/logger");
    const result = LoggerModuleSchema.safeParse(module);
    if (result.success) return result.data.default;
    return null;
  } catch {
    return null;
  }
}
