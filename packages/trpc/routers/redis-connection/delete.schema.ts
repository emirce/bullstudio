import { z } from "zod";

export const deleteRedisConnectionSchema = z.object({
  connectionId: z.string(),
});

export type DeleteRedisConnectionInput = z.infer<typeof deleteRedisConnectionSchema>;
