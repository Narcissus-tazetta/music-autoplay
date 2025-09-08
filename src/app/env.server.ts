import { z } from "zod";

const serverEnvSchema = z
  .object({
    YOUTUBE_API_KEY: z
      .string({ required_error: "YOUTUBE_API_KEYは必須です" })
      .min(1, {
        message: "YOUTUBE_API_KEYは必須です",
      }),
    SESSION_SECRET: z
      .string({ required_error: "SESSION_SECRETは必須です" })
      .min(1, {
        message: "SESSION_SECRETは必須です",
      }),
    ADMIN_SECRET: z
      .string({ required_error: "ADMIN_SECRETは必須です" })
      .min(32, {
        message: "ADMIN_SECRET must be at least 32 characters long",
      }),
    GOOGLE_CLIENT_ID: z.string({
      required_error: "GOOGLE_CLIENT_IDは必須です",
    }),
    GOOGLE_CLIENT_SECRET: z.string({
      required_error: "GOOGLE_CLIENT_SECRETは必須です",
    }),
    CLIENT_URL: z.string({ required_error: "CLIENT_URLは必須です" }),
  })
  .strict();

export const SERVER_ENV = (() => {
  const parsed = serverEnvSchema.safeParse({
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CLIENT_URL:
      process.env.NODE_ENV === "production"
        ? "https://music-autoplay.onrender.com"
        : "http://localhost:3000",
  });

  if (!parsed.success) {
    throw new Error(
      Object.values(parsed.error.flatten().fieldErrors)
        .flat()
        .filter(Boolean)
        .join("\n"),
    );
  }

  return parsed.data;
})();
