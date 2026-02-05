import { Queue, Job as BullJob } from "bullmq";
import Redis from "ioredis";
import type {
  QueueService,
  QueueProviderType,
  QueueServiceConfig,
  QueueServiceEventCallbacks,
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

const DEFAULT_PREFIX = "bull";

export class BullMqProvider implements QueueService {
  readonly providerType: QueueProviderType = "bullmq";

  private readonly config: QueueServiceConfig;
  private readonly eventCallbacks: QueueServiceEventCallbacks;
  private connection: Redis | null = null;
  private queues = new Map<string, Queue>();
  private _isConnected = false;
  private _isReconnecting = false;

  constructor(config: QueueServiceConfig) {
    this.config = {
      prefix: DEFAULT_PREFIX,
      ...config,
    };
    this.eventCallbacks = config.eventCallbacks ?? {};
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

    await this.connection.connect();
    await this.connection.ping();
    this._isConnected = true;
  }

  private setupEventListeners(): void {
    if (!this.connection) return;

    // Handle errors - this prevents unhandled error events
    this.connection.on("error", (error: Error) => {
      console.error("[BullMqProvider] Redis error:", error.message);
      if (this._isConnected && !this._isReconnecting) {
        this._isConnected = false;
        this.eventCallbacks.onError?.(error);
      }
    });

    // Handle connection close
    this.connection.on("close", () => {
      console.log("[BullMqProvider] Redis connection closed");
      if (this._isConnected && !this._isReconnecting) {
        this._isConnected = false;
        this.eventCallbacks.onDisconnect?.("Connection closed");
      }
    });

    // Handle end (connection fully terminated)
    this.connection.on("end", () => {
      console.log("[BullMqProvider] Redis connection ended");
      if (this._isConnected) {
        this._isConnected = false;
        this.eventCallbacks.onDisconnect?.("Connection ended");
      }
    });

    // Handle reconnecting (ioredis internal reconnection)
    this.connection.on("reconnecting", () => {
      console.log("[BullMqProvider] Redis reconnecting...");
      this._isReconnecting = true;
      this.eventCallbacks.onReconnecting?.();
    });

    // Handle ready (reconnected)
    this.connection.on("ready", () => {
      console.log("[BullMqProvider] Redis ready");
      if (this._isReconnecting) {
        this._isReconnecting = false;
        this._isConnected = true;
        this.eventCallbacks.onReconnected?.();
      }
    });
  }

  async disconnect(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close(),
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
      queueNames.map((name) => this.getQueue(name)),
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
    const counts = await queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused",
      "prioritized",
      "waiting-children",
    );

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
      prioritized: counts.prioritized ?? 0,
      waitingChildren: counts["waiting-children"] ?? 0,
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
    const jobs = await queue.getJobs(statuses, offset, offset + limit - 1);

    let mappedJobs = jobs
      .filter((job): job is BullJob => job !== undefined)
      .map((job) => this.mapJob(job, this.mapJobState(job), queueName));

    if (filter?.name) {
      mappedJobs = mappedJobs.filter((job) => job.name === filter.name);
    }

    if (sort) {
      mappedJobs = this.sortJobs(mappedJobs, sort.field, sort.order);
    }

    return mappedJobs;
  }

  async getJobsSummary(
    queueName: string,
    options?: JobQueryOptions,
  ): Promise<JobSummary[]> {
    const queue = this.getOrCreateQueue(queueName);
    const { filter, sort, limit = 100, offset = 0 } = options ?? {};

    const statuses = this.resolveStatuses(filter?.status);
    const jobs = await queue.getJobs(statuses, offset, offset + limit - 1);

    let mappedJobs = jobs
      .filter((job): job is BullJob => job !== undefined)
      .map((job) => this.mapJobSummary(job, this.mapJobState(job), queueName));

    if (filter?.name) {
      mappedJobs = mappedJobs.filter((job) => job.name === filter.name);
    }

    if (sort) {
      mappedJobs = this.sortJobSummaries(mappedJobs, sort.field, sort.order);
    }

    return mappedJobs;
  }

  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.getOrCreateQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return this.mapJob(job, state, queueName);
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

  private getOrCreateQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      if (!this.connection) {
        throw new NotConnectedError();
      }
      queue = new Queue(name, {
        connection: this.connection,
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
    const pattern = `${prefix}:*:meta`;
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
    status?: JobStatus | JobStatus[],
  ): (
    | "waiting"
    | "active"
    | "completed"
    | "failed"
    | "delayed"
    | "paused"
    | "prioritized"
    | "waiting-children"
  )[] {
    if (!status) {
      return [
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
        "prioritized",
        "waiting-children",
      ];
    }

    const statuses = Array.isArray(status) ? status : [status];
    return statuses as (
      | "waiting"
      | "active"
      | "completed"
      | "failed"
      | "delayed"
      | "paused"
      | "prioritized"
      | "waiting-children"
    )[];
  }

  private mapJob(job: BullJob, state: string, queueName: string): Job {
    return {
      id: job.id ?? "",
      name: job.name,
      queueName,
      data: job.data,
      status: state as JobStatus,
      progress: this.normalizeProgress(job.progress),
      attemptsMade: job.attemptsMade,
      attemptsLimit: job.opts?.attempts ?? 1,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnValue: job.returnvalue,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      delay: job.opts?.delay,
      priority: job.opts?.priority,
      parentId: job.parentKey?.split(":").pop(),
      repeatJobKey: job.repeatJobKey,
    };
  }

  private mapJobSummary(
    job: BullJob,
    state: string,
    queueName: string,
  ): JobSummary {
    const dataStr = job.data ? JSON.stringify(job.data) : "";
    return {
      id: job.id ?? "",
      name: job.name,
      queueName,
      status: state as JobStatus,
      progress: this.normalizeProgress(job.progress),
      attemptsMade: job.attemptsMade,
      attemptsLimit: job.opts?.attempts ?? 1,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      delay: job.opts?.delay,
      priority: job.opts?.priority,
      parentId: job.parentKey?.split(":").pop(),
      repeatJobKey: job.repeatJobKey,
      hasData: !!job.data,
      dataSize: dataStr.length,
      hasReturnValue: job.returnvalue !== undefined && job.returnvalue !== null,
      hasStacktrace: Array.isArray(job.stacktrace) && job.stacktrace.length > 0,
      hasFailedReason: !!job.failedReason,
      failedReason: job.failedReason,
    };
  }

  private mapJobState(job: BullJob): JobStatus {
    if (job.finishedOn && job.failedReason) {
      return "failed";
    }
    if (job.finishedOn) {
      return "completed";
    }
    if (job.processedOn) {
      return "active";
    }
    if (job.opts?.delay && job.timestamp + job.opts.delay > Date.now()) {
      return "delayed";
    }
    return "waiting";
  }

  private normalizeProgress(
    progress: number | string | object | boolean,
  ): number | object {
    if (typeof progress === "boolean") {
      return progress ? 100 : 0;
    }
    if (typeof progress === "string") {
      const parsed = parseFloat(progress);
      return isNaN(parsed) ? { value: progress } : parsed;
    }
    return progress;
  }

  private sortJobs(
    jobs: Job[],
    field: "timestamp" | "processedOn" | "finishedOn" | "progress",
    order: "asc" | "desc",
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

  private sortJobSummaries(
    jobs: JobSummary[],
    field: "timestamp" | "processedOn" | "finishedOn" | "progress",
    order: "asc" | "desc",
  ): JobSummary[] {
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
