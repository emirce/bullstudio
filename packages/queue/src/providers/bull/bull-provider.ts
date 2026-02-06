import Bull from "bull";
import type { Job as BullJob } from "bull";
import Redis from "ioredis";
import type {
  QueueService,
  QueueProviderType,
  QueueServiceConfig,
  QueueServiceEventCallbacks,
  QueueProviderCapabilities,
} from "../../types";
import type {
  Job,
  JobSummary,
  Queue as IQueue,
  JobCounts,
  JobQueryOptions,
  JobStatus,
  WorkerCount,
} from "@bullstudio/connect-types";
import { NotConnectedError, JobNotFoundError } from "../../errors";
import { getProviderCapabilities } from "../../types";

const DEFAULT_PREFIX = "bull";

// Bull-specific job states (no prioritized, no waiting-children, no paused per-job)
type BullJobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed";

export class BullProvider implements QueueService {
  readonly providerType: QueueProviderType = "bull";

  private readonly config: QueueServiceConfig;
  private readonly eventCallbacks: QueueServiceEventCallbacks;
  private connection: Redis | null = null;
  private queues = new Map<string, Bull.Queue>();
  private _isConnected = false;
  private _isReconnecting = false;

  constructor(config: QueueServiceConfig) {
    this.config = {
      prefix: DEFAULT_PREFIX,
      ...config,
    };
    this.eventCallbacks = config.eventCallbacks ?? {};
  }

  getCapabilities(): QueueProviderCapabilities {
    return getProviderCapabilities("bull");
  }

  async connect(): Promise<void> {
    if (this._isConnected) {
      return;
    }

    this.connection = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      // Disable ioredis built-in retry - we handle it ourselves
      retryStrategy: () => null,
    });

    this.setupEventListeners();

    try {
      await this.connection.connect();
      await this.connection.ping();
      this._isConnected = true;
    } catch (error) {
      // Cleanup on failure
      if (this.connection) {
        await this.connection.quit().catch(() => {});
        this.connection = null;
      }
      this._isConnected = false;
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.connection) return;

    // Handle errors - this prevents unhandled error events
    this.connection.on("error", (error: Error) => {
      console.error("[BullProvider] Redis error:", error.message);
      if (this._isConnected && !this._isReconnecting) {
        this._isConnected = false;
        this.eventCallbacks.onError?.(error);
      }
    });

    // Handle connection close
    this.connection.on("close", () => {
      console.log("[BullProvider] Redis connection closed");
      if (this._isConnected && !this._isReconnecting) {
        this._isConnected = false;
        this.eventCallbacks.onDisconnect?.("Connection closed");
      }
    });

    // Handle end (connection fully terminated)
    this.connection.on("end", () => {
      console.log("[BullProvider] Redis connection ended");
      if (this._isConnected) {
        this._isConnected = false;
        this.eventCallbacks.onDisconnect?.("Connection ended");
      }
    });

    // Handle reconnecting (ioredis internal reconnection)
    this.connection.on("reconnecting", () => {
      console.log("[BullProvider] Redis reconnecting...");
      this._isReconnecting = true;
      this.eventCallbacks.onReconnecting?.();
    });

    // Handle ready (reconnected)
    this.connection.on("ready", () => {
      console.log("[BullProvider] Redis ready");
      if (this._isReconnecting) {
        this._isReconnecting = false;
        this._isConnected = true;
        this.eventCallbacks.onReconnected?.();
      }
    });
  }

  async disconnect(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );
    await Promise.all(closePromises);
    this.queues.clear();

    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }

    this._isConnected = false;
  }

  isConnected(): boolean {
    return this._isConnected && this.connection?.status === "ready";
  }

  async getQueues(): Promise<IQueue[]> {
    const queueNames = await this.discoverQueues();
    const queues = await Promise.all(
      queueNames.map((name) => this.getQueue(name))
    );
    return queues.filter((q): q is IQueue => q !== null);
  }

  async getQueue(name: string): Promise<IQueue | null> {
    const queue = this.getOrCreateQueue(name);
    const [isPaused, jobCounts] = await Promise.all([
      queue.isPaused(),
      this.getJobCounts(name),
    ]);

    return {
      name,
      isPaused,
      jobCounts,
    };
  }

  async getJobCounts(queueName: string): Promise<JobCounts> {
    const queue = this.getOrCreateQueue(queueName);
    const counts = await queue.getJobCounts();
    // Bull's JobCounts only has: active, completed, failed, delayed, waiting
    // Paused jobs are in the 'waiting' count but queue itself can be paused

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: 0, // Bull doesn't track paused separately
      // Bull doesn't support these states
      prioritized: 0,
      waitingChildren: 0,
    };
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);
    await queue.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);
    await queue.resume();
  }

  async getJobs(queueName: string, options?: JobQueryOptions): Promise<Job[]> {
    const queue = this.getOrCreateQueue(queueName);
    const { filter, sort, limit = 100, offset = 0 } = options ?? {};

    const statuses = this.resolveStatuses(filter?.status);

    // Bull's getJobs can accept an array of states
    const jobs = await queue.getJobs(statuses, offset, offset + limit - 1);

    let mappedJobs = jobs
      .filter((job): job is BullJob => job !== null && job !== undefined)
      .map((job) => this.mapJob(job, queueName));

    if (filter?.name) {
      mappedJobs = mappedJobs.filter((job) => job.name === filter.name);
    }

    if (sort) {
      mappedJobs = this.sortJobs(mappedJobs, sort.field, sort.order);
    }

    return mappedJobs.slice(0, limit);
  }

  async getJobsSummary(
    queueName: string,
    options?: JobQueryOptions
  ): Promise<JobSummary[]> {
    // Bull doesn't have an efficient metadata-only fetch like BullMQ
    // Fall back to full job fetching and map to summary
    const jobs = await this.getJobs(queueName, options);
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      status: job.status,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      delay: job.delay,
      priority: job.priority,
      parentId: undefined, // Bull doesn't support parent-child
      repeatJobKey: job.repeatJobKey,
      failedReason: job.failedReason,
    }));
  }

  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.getOrCreateQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return this.mapJob(job, queueName);
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new JobNotFoundError(queueName, jobId);
    }

    await job.retry();
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getOrCreateQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new JobNotFoundError(queueName, jobId);
    }

    await job.remove();
  }

  async getWorkerCount(queueName: string): Promise<WorkerCount> {
    const queue = this.getOrCreateQueue(queueName);
    const workers = await queue.getWorkers();

    return {
      queueName,
      count: workers.length,
    };
  }

  private getOrCreateQueue(name: string): Bull.Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      if (!this.connection) {
        throw new NotConnectedError();
      }

      // Bull uses createClient for connection reuse
      queue = new Bull(name, {
        createClient: (type) => {
          // Reuse existing connection for client type
          // Create new connections for subscriber and bclient (blocking client)
          if (type === "client") {
            return this.connection!.duplicate();
          }
          return new Redis(this.config.redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
          });
        },
        prefix: this.config.prefix,
      });
      this.queues.set(name, queue);
    }
    return queue;
  }

  private async discoverQueues(): Promise<string[]> {
    if (!this.connection) {
      throw new NotConnectedError();
    }

    const prefix = this.config.prefix ?? DEFAULT_PREFIX;
    // Bull stores job ID counter in bull:queueName:id
    const pattern = `${prefix}:*:id`;
    const keys = await this.connection.keys(pattern);

    const queueNames = keys
      .map((key) => {
        const parts = key.split(":");
        return parts[1] ?? "";
      })
      .filter(Boolean);

    return [...new Set(queueNames)];
  }

  private resolveStatuses(
    status?: JobStatus | JobStatus[]
  ): BullJobStatus[] {
    if (!status) {
      return ["waiting", "active", "completed", "failed", "delayed"];
    }

    const statuses = Array.isArray(status) ? status : [status];
    // Filter out unsupported statuses (prioritized, waiting-children, paused)
    return statuses.filter((s): s is BullJobStatus =>
      ["waiting", "active", "completed", "failed", "delayed"].includes(s)
    );
  }

  private mapJob(job: BullJob, queueName: string): Job {
    const state = this.getJobState(job);
    const progress = job.progress();

    return {
      id: String(job.id),
      name: job.name,
      queueName,
      data: job.data,
      status: state,
      progress: this.normalizeProgress(progress),
      attemptsMade: job.attemptsMade,
      attemptsLimit: job.opts.attempts ?? 1,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnValue: job.returnvalue,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      delay: job.opts.delay,
      priority: job.opts.priority,
      parentId: undefined, // Bull doesn't support parent-child
      repeatJobKey: job.opts.repeat ? job.id?.toString() : undefined,
    };
  }

  private getJobState(job: BullJob): JobStatus {
    // Check finished states first
    if (job.finishedOn) {
      if (job.failedReason) {
        return "failed";
      }
      return "completed";
    }

    // Check if processing
    if (job.processedOn) {
      return "active";
    }

    // Check if delayed
    if (job.opts.delay && job.timestamp + job.opts.delay > Date.now()) {
      return "delayed";
    }

    return "waiting";
  }

  private normalizeProgress(
    progress: number | object
  ): number | object {
    if (typeof progress === "number") {
      return progress;
    }
    if (typeof progress === "object" && progress !== null) {
      return progress;
    }
    return 0;
  }

  private sortJobs(
    jobs: Job[],
    field: "timestamp" | "processedOn" | "finishedOn" | "progress",
    order: "asc" | "desc"
  ): Job[] {
    return [...jobs].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      if (field === "progress") {
        aValue = typeof a.progress === "number" ? a.progress : 0;
        bValue = typeof b.progress === "number" ? b.progress : 0;
      } else {
        aValue = a[field] ?? 0;
        bValue = b[field] ?? 0;
      }

      return order === "asc" ? aValue - bValue : bValue - aValue;
    });
  }
}
