import Redis from "ioredis";
import { detectProvider, discoverPrefixes } from "../detection";
import type {
  QueueProviderType,
  QueueService,
  QueueServiceConfig,
} from "../types";
import {
  createRedisConnection,
  isClusterEnabled,
  type RedisConnection,
} from "../utils";
import { BullProvider } from "./bull";
import { BullMqProvider } from "./bullmq";

/**
 * Auto-detect and create appropriate queue provider.
 * When `prefixes: ["*"]` is set, discovers all
 * prefixes before detecting the provider type.
 *
 * Cluster mode is detected from the target Redis itself (`INFO cluster`) and
 * recorded on the provider config, so providers connect with a cluster client
 * and discovery fans out across every master node.
 */
export async function createQueueProvider(
  config: QueueServiceConfig,
): Promise<QueueService> {
  let redis: RedisConnection = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  // This short-lived detection client is closed in `finally`. Attach an error
  // listener so a connection drop during detection is swallowed rather than
  // surfacing as an unhandled "error" event that crashes the process.
  redis.on("error", () => {});

  let finalConfig: QueueServiceConfig = {
    ...config,
  };

  try {
    await redis.connect();

    const cluster = await isClusterEnabled(redis);
    if (cluster) {
      // Prefix and provider detection SCAN the keyspace, and each cluster
      // node only returns keys for its own slots — swap the single-node
      // detection client for a cluster client before scanning.
      await redis.quit().catch(() => {});
      redis = createRedisConnection(config.redisUrl, {
        cluster: true,
        lazyConnect: true,
        retryStrategy: () => null,
      });
      redis.on("error", () => {});
      await redis.connect();
      console.log("[ProviderFactory] Redis Cluster detected");
    }

    let prefixes = config.prefixes;

    if (prefixes?.includes("*")) {
      const found = await discoverPrefixes(redis);
      if (found.length > 0) {
        prefixes = found;
        console.log(
          `[ProviderFactory] Discovered prefixes: ${found.join(", ")}`,
        );
      } else {
        prefixes = [config.prefix ?? "bull"];
      }
    }

    finalConfig = { ...config, prefixes, cluster };

    const detectionPrefix = prefixes?.[0] ?? config.prefix ?? "bull";
    const detection = await detectProvider(redis, detectionPrefix);

    console.log(
      `[ProviderFactory] Detected provider: ` +
        `${detection.type} ` +
        `(${detection.confidence} confidence ` +
        `from ${detection.detectedFrom})`,
    );

    return createProviderByType(detection.type, finalConfig);
  } catch (error) {
    console.error("[ProviderFactory] Detection failed:", error);
    return new BullMqProvider(finalConfig);
  } finally {
    await redis.quit().catch(() => {});
  }
}

/**
 * Create provider with explicit type (for testing or when type is known).
 */
export function createProviderByType(
  type: QueueProviderType,
  config: QueueServiceConfig,
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
