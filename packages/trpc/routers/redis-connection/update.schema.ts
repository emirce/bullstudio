import { z } from "zod";

export const updateRedisConnectionSchema = z.object({
  connectionId: z.string(),
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  database: z.number().int().min(0).max(15).optional(),
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  tls: z.boolean().optional(),
  tlsCert: z.string().nullable().optional(),
});

export type UpdateRedisConnectionInput = z.infer<typeof updateRedisConnectionSchema>;
