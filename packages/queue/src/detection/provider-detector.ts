import type Redis from "ioredis";
import type { QueueProviderType } from "../types";

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
 */
export async function detectProvider(
  redis: Redis,
  prefix: string = "bull"
): Promise<ProviderDetectionResult> {
  try {
    // Check for BullMQ meta keys (bull:*:meta)
    const metaPattern = `${prefix}:*:meta`;
    const metaKeys = await redis.keys(metaPattern);

    if (metaKeys.length > 0) {
      return {
        type: "bullmq",
        confidence: "high",
        detectedFrom: "meta-keys",
      };
    }

    // Check for Bull id keys (bull:*:id)
    const idPattern = `${prefix}:*:id`;
    const idKeys = await redis.keys(idPattern);

    if (idKeys.length > 0) {
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
      error
    );
    return {
      type: "bullmq",
      confidence: "low",
      detectedFrom: "default",
    };
  }
}
