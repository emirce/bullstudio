import { z } from "zod";

export const getRedisConnectionSchema = z.object({
  connectionId: z.string(),
});

export type GetRedisConnectionInput = z.infer<typeof getRedisConnectionSchema>;
