import type {
  Job,
  JobSummary,
  Queue,
  JobCounts,
  JobQueryOptions,
  WorkerCount,
} from "@bullstudio/connect-types";
import type { QueueProviderCapabilities } from "./provider-capabilities.types";

/**
 * Provider type identifier for extensibility.
 */
export type QueueProviderType = "bullmq" | "bull" | "agenda" | "bee";

/**
 * Callbacks for connection events from the queue service.
 */
export interface QueueServiceEventCallbacks {
  onDisconnect?: (reason?: string) => void;
  onError?: (error: Error) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
}

/**
 * Configuration for initializing a queue service provider.
 */
export interface QueueServiceConfig {
  redisUrl: string;
  prefix?: string;
  eventCallbacks?: QueueServiceEventCallbacks;
}

/**
 * Abstract interface for queue service providers.
 * Implement this interface to add support for different queue systems.
 */
export interface QueueService {
  /** Provider type identifier */
  readonly providerType: QueueProviderType;

  /** Establish connection to the queue backend */
  connect(): Promise<void>;

  /** Gracefully disconnect from the queue backend */
  disconnect(): Promise<void>;

  /** Check if currently connected */
  isConnected(): boolean;

  // Queue operations
  getQueues(): Promise<Queue[]>;
  getQueue(name: string): Promise<Queue | null>;
  pauseQueue(queueName: string): Promise<void>;
  resumeQueue(queueName: string): Promise<void>;
  getJobCounts(queueName: string): Promise<JobCounts>;

  // Job operations
  getJobs(queueName: string, options?: JobQueryOptions): Promise<Job[]>;
  getJobsSummary(
    queueName: string,
    options?: JobQueryOptions,
  ): Promise<JobSummary[]>;
  getJob(queueName: string, jobId: string): Promise<Job | null>;
  retryJob(queueName: string, jobId: string): Promise<void>;
  removeJob(queueName: string, jobId: string): Promise<void>;

  // Worker operations
  getWorkerCount(queueName: string): Promise<WorkerCount>;

  // Provider capabilities
  getCapabilities(): QueueProviderCapabilities;
}
