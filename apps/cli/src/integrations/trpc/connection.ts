import { BullMqProvider } from "@bullstudio/queue";

let provider: BullMqProvider | null = null;

export const getQueueProvider = async (): Promise<BullMqProvider> => {
  if (!provider) {
    provider = new BullMqProvider({
      redisUrl: "redis://localhost:6379",
    });
    await provider.connect();
  }
  return provider;
};
