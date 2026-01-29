import { createTRPCRouter, publicProcedure } from "../init";

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port || "6379",
      hasPassword: !!parsed.password,
      database: parsed.pathname.slice(1) || "0",
    };
  } catch {
    return {
      host: "localhost",
      port: "6379",
      hasPassword: false,
      database: "0",
    };
  }
}

export const connectionRouter = createTRPCRouter({
  info: publicProcedure.query(() => {
    const redisUrl = getRedisUrl();
    const parsed = parseRedisUrl(redisUrl);

    return {
      host: parsed.host,
      port: parsed.port,
      hasPassword: parsed.hasPassword,
      database: parsed.database,
      // Don't expose full URL with password
      displayUrl: `${parsed.host}:${parsed.port}`,
    };
  }),
});
