import type { JobStatus } from "@bullstudio/connect-types";
import type { QueueProviderType } from "./queue-service.types";

/**
 * Capabilities exposed by a queue provider.
 * Used to conditionally render UI features based on provider support.
 */
export interface QueueProviderCapabilities {
  providerType: QueueProviderType;
  displayName: string;
  supportsFlows: boolean;
  supportedJobStates: JobStatus[];
}

/**
 * Get capabilities for a given provider type.
 */
export function getProviderCapabilities(
  providerType: QueueProviderType
): QueueProviderCapabilities {
  switch (providerType) {
    case "bull":
      return {
        providerType: "bull",
        displayName: "Bull",
        supportsFlows: false,
        // Bull doesn't expose individual job paused state - it's queue-level only
        supportedJobStates: [
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
        ],
      };
    case "bullmq":
      return {
        providerType: "bullmq",
        displayName: "BullMQ",
        supportsFlows: true,
        supportedJobStates: [
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
          "paused",
          "waiting-children",
        ],
      };
    case "agenda":
    case "bee":
      throw new Error(`Provider type "${providerType}" not yet implemented`);
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}
