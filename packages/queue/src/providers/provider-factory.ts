import Redis from "ioredis";
import type { QueueService, QueueServiceConfig, QueueProviderType } from "../types";
import { BullMqProvider } from "./bullmq";
import { BullProvider } from "./bull";
import { detectProvider } from "../detection";

/**
 * Auto-detect and create appropriate queue provider.
 * Detection happens once per connection by scanning Redis keys.
 */
export async function createQueueProvider(
  config: QueueServiceConfig
): Promise<QueueService> {
  // Create temporary Redis connection for detection
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  try {
    await redis.connect();

    // Detect provider type
    const detection = await detectProvider(redis, config.prefix ?? "bull");

    console.log(
      `[ProviderFactory] Detected provider: ${detection.type} (${detection.confidence} confidence from ${detection.detectedFrom})`
    );

    // Create appropriate provider
    return createProviderByType(detection.type, config);
  } catch (error) {
    console.error("[ProviderFactory] Detection failed:", error);

    // Default to BullMQ on error
    return new BullMqProvider(config);
  } finally {
    // Always close the detection connection
    await redis.quit().catch(() => {});
  }
}

/**
 * Create provider with explicit type (for testing or when type is known).
 */
export function createProviderByType(
  type: QueueProviderType,
  config: QueueServiceConfig
): QueueService {
  switch (type) {
    case "bull":
      return new BullProvider(config);
    case "bullmq":
      return new BullMqProvider(config);
    case "agenda":
    case "bee":
      throw new Error(`Provider type "${type}" not yet implemented`);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
