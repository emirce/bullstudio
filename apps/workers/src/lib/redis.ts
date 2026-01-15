import Redis from "ioredis";

const REDIS_URL = process.env.WORKER_REDIS_URL ?? process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("WORKER_REDIS_URL or REDIS_URL environment variable is required");
}

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export { REDIS_URL };
