import type { QueueProviderType } from "../types";
import { type RedisConnection, scanTargets } from "../utils";

export interface ProviderDetectionResult {
  type: QueueProviderType;
  confidence: "high" | "medium" | "low";
  detectedFrom: "meta-keys" | "id-keys" | "default";
}

/**
 * Detect queue provider type by analyzing Redis key patterns.
 *
 * BullMQ uses: bull:queueName:meta (metadata keys)
 * Bull uses: bull:queueName:id (direct job ID counter)
 *
 * On a cluster every master node is sampled, since each node only holds the
 * keys for its own slots.
 */
export async function detectProvider(
  redis: RedisConnection,
  prefix: string = "bull",
): Promise<ProviderDetectionResult> {
  try {
    // Check for BullMQ meta keys (bull:*:meta)
    const metaPattern = `${prefix}:*:meta`;
    if (await anyKeyMatches(redis, metaPattern)) {
      return {
        type: "bullmq",
        confidence: "high",
        detectedFrom: "meta-keys",
      };
    }

    // Check for Bull id keys (bull:*:id)
    const idPattern = `${prefix}:*:id`;
    if (await anyKeyMatches(redis, idPattern)) {
      return {
        type: "bull",
        confidence: "high",
        detectedFrom: "id-keys",
      };
    }

    // No queues found - default to BullMQ for new installations
    return {
      type: "bullmq",
      confidence: "low",
      detectedFrom: "default",
    };
  } catch (error) {
    console.warn(
      "[ProviderDetector] Detection failed, defaulting to BullMQ:",
      error,
    );
    return {
      type: "bullmq",
      confidence: "low",
      detectedFrom: "default",
    };
  }
}

/**
 * True when a single SCAN page on any scan target returns a key matching
 * `pattern`. A sample is enough for detection; discovery does the full walk.
 */
async function anyKeyMatches(
  redis: RedisConnection,
  pattern: string,
): Promise<boolean> {
  for (const node of scanTargets(redis)) {
    const [, keys] = await node.scan("0", "MATCH", pattern, "COUNT", 100);
    if (keys.length > 0) {
      return true;
    }
  }
  return false;
}
