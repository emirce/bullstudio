import { z } from "zod";

export const listRedisConnectionsSchema = z.object({
  workspaceId: z.string(),
});

export type ListRedisConnectionsInput = z.infer<typeof listRedisConnectionsSchema>;
