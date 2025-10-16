import { z } from "zod";

export const ServiceDependenciesSchema = z.object({
  youtubeService: z
    .object({
      getVideoDetails: z.function(),
    })
    .passthrough()
    .optional(),

  fileStore: z
    .object({
      add: z.function(),
      remove: z.function(),
      getAll: z.function(),
    })
    .passthrough()
    .optional(),

  configService: z
    .object({
      getString: z.function().args(z.string()).returns(z.string().nullable()),
    })
    .passthrough()
    .optional(),

  musicDB: z.instanceof(Map).optional(),

  io: z
    .object({
      emit: z.function(),
    })
    .passthrough()
    .optional(),
});

export type ValidatedServiceDependencies = z.infer<
  typeof ServiceDependenciesSchema
>;
