import type {
  AddJobInput,
  Job,
  JobCounts,
  JobQueryOptions,
  JobScheduler,
  JobSchedulerTarget,
  JobSummary,
  Queue,
  QueueMetricSnapshot,
  QueueMetricType,
  UpsertJobSchedulerInput,
  Worker,
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
  /** Single prefix (backward compat). Ignored when prefixes is set. */
  prefix?: string;
  /** Explicit list of prefixes. Use `["*"]` for auto-discovery. */
  prefixes?: string[];
  /** Connect with a Redis Cluster client (set by provider detection). */
  cluster?: boolean;
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

  /** Return all discovered prefixes. */
  getPrefixes(): Promise<string[]>;

  // Queue operations
  getQueues(): Promise<Queue[]>;
  getQueue(name: string, prefix?: string): Promise<Queue | null>;
  pauseQueue(queueName: string, prefix?: string): Promise<void>;
  resumeQueue(queueName: string, prefix?: string): Promise<void>;
  drainQueue(queueName: string, prefix?: string): Promise<void>;
  getJobCounts(queueName: string, prefix?: string): Promise<JobCounts>;

  // Job operations
  getJobs(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<Job[]>;
  getJobsSummary(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<JobSummary[]>;
  getMetrics(
    queueName: string,
    type: QueueMetricType,
    prefix?: string,
  ): Promise<QueueMetricSnapshot | null>;
  getJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<Job | null>;
  getJobLogs(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<{ logs: string[]; count: number }>;
  retryJob(queueName: string, jobId: string, prefix?: string): Promise<void>;
  retryFailedJobs(queueName: string, prefix?: string): Promise<number>;
  removeJob(queueName: string, jobId: string, prefix?: string): Promise<void>;
  addJob(queueName: string, input: AddJobInput, prefix?: string): Promise<void>;

  // Worker operations
  getWorkerCount(queueName: string, prefix?: string): Promise<WorkerCount>;
  listWorkers(queueName: string, prefix?: string): Promise<Worker[]>;

  // Job scheduler operations
  listJobSchedulers(
    queueName: string,
    options?: { limit?: number },
    prefix?: string,
  ): Promise<JobScheduler[]>;
  getJobScheduler(
    queueName: string,
    target: JobSchedulerTarget,
    prefix?: string,
  ): Promise<JobScheduler | null>;
  upsertJobScheduler(
    queueName: string,
    input: UpsertJobSchedulerInput,
    prefix?: string,
  ): Promise<void>;
  removeJobScheduler(
    queueName: string,
    target: JobSchedulerTarget,
    prefix?: string,
  ): Promise<boolean>;

  // Provider capabilities
  getCapabilities(): QueueProviderCapabilities;
}
