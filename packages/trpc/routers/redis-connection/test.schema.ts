import { z } from "zod";

export const testRedisConnectionSchema = z.object({
  connectionId: z.string().optional(),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.number().int().min(0).max(15),
  username: z.string().optional(),
  password: z.string().optional(),
  tls: z.boolean(),
  tlsCert: z.string().optional(),
});

export type TestRedisConnectionInput = z.infer<typeof testRedisConnectionSchema>;
