import { z } from "zod";

export const createRedisConnectionSchema = z.object({
  workspaceId: z.string(),
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  host: z.string().min(1, "Host is required"),
  port: z.number().int().min(1).max(65535).default(6379),
  database: z.number().int().min(0).max(15).default(0),
  username: z.string().optional(),
  password: z.string().optional(),
  tls: z.boolean().default(false),
  tlsCert: z.string().optional(),
});

export type CreateRedisConnectionInput = z.infer<typeof createRedisConnectionSchema>;
