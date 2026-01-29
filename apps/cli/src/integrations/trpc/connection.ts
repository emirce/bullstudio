import { BullMqProvider } from "@bullstudio/queue";

let provider: BullMqProvider | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

export const getQueueProvider = async (): Promise<BullMqProvider> => {
  const redisUrl = getRedisUrl();

  // If URL changed, disconnect old provider and create new one
  if (provider && (provider as BullMqProvider & { redisUrl?: string }).redisUrl !== redisUrl) {
    await provider.disconnect();
    provider = null;
  }

  if (!provider) {
    provider = new BullMqProvider({ redisUrl });
    (provider as BullMqProvider & { redisUrl?: string }).redisUrl = redisUrl;
    await provider.connect();
  }
  return provider;
};

export const disconnectProvider = async (): Promise<void> => {
  if (provider) {
    await provider.disconnect();
    provider = null;
  }
};
