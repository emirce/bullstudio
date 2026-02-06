// Types
export type {
  ConnectionConfig,
  ConnectionStatus,
  ConnectionTestResult,
  ConnectionState,
  ConnectionEvent,
  ConnectionEventListener,
} from "./types";

export type {
  QueueService,
  QueueServiceConfig,
  QueueProviderType,
} from "./types";

// Classes
export {
  ConnectionManager,
  type ConnectionManagerConfig,
} from "./connection-manager";
export { BullMqProvider, BullProvider } from "./providers";

// Factory
export { createQueueProvider, createProviderByType } from "./providers/provider-factory";

// Detection
export { detectProvider, type ProviderDetectionResult } from "./detection";

// Errors
export * from "./errors";

// Singleton instance factory
import { ConnectionManager } from "./connection-manager";

let instance: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
  if (!instance) {
    instance = new ConnectionManager({});
  }
  return instance;
}

export function resetConnectionManager(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
