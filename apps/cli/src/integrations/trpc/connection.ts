import { createQueueProvider, type QueueService } from "@bullstudio/queue";

let provider: QueueService | null = null;
let providerRedisUrl: string | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

export const getQueueProvider = async (): Promise<QueueService> => {
  const redisUrl = getRedisUrl();

  // If URL changed, disconnect old provider and create new one
  if (provider && providerRedisUrl !== redisUrl) {
    await provider.disconnect();
    provider = null;
    providerRedisUrl = null;
  }

  if (!provider) {
    // Use factory to auto-detect and create provider
    provider = await createQueueProvider({ redisUrl });
    providerRedisUrl = redisUrl;
    await provider.connect();
    console.log(
      `[CLI] Connected to ${provider.getCapabilities().displayName} (${provider.providerType})`
    );
  }
  return provider;
};

export const disconnectProvider = async (): Promise<void> => {
  if (provider) {
    await provider.disconnect();
    provider = null;
  }
};
