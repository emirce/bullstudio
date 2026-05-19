import { Queue, Job as BullJob, JobType } from "bullmq";
import Redis from "ioredis";
import type {
  QueueService,
  QueueProviderType,
  QueueServiceConfig,
  QueueServiceEventCallbacks,
  QueueProviderCapabilities,
} from "../../types";
import { getProviderCapabilities } from "../../types";
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
import { discoverPrefixes } from "../../detection/prefix-discovery";
import { parseQueueNameFromKey } from "../redis-key";

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

  private resolvedPrefixes: string[] | null = null;

  private queueKey(
    prefix: string, name: string,
  ): string {
    return `${prefix}\0${name}`;
  }

  private get defaultPrefix(): string {
    if (this.config.prefix) {
      return this.config.prefix;
    }
    const explicit =
      this.config.prefixes?.filter(
        (p) => p !== "*",
      );
    if (explicit?.length === 1) {
      return explicit[0]!;
    }
    return DEFAULT_PREFIX;
  }

  private async getActivePrefixes(): Promise<string[]> {
    if (this.resolvedPrefixes) {
      return this.resolvedPrefixes;
    }
    const explicit = this.config.prefixes;
    if (
      explicit &&
      explicit.length > 0 &&
      !explicit.includes("*")
    ) {
      this.resolvedPrefixes = explicit;
      return explicit;
    }
    if (
      explicit?.includes("*") &&
      this.connection
    ) {
      const found = await discoverPrefixes(
        this.connection,
      );
      this.resolvedPrefixes =
        found.length > 0
          ? found
          : [this.defaultPrefix];
      return this.resolvedPrefixes;
    }
    this.resolvedPrefixes = [this.defaultPrefix];
    return this.resolvedPrefixes;
  }

  getCapabilities(): QueueProviderCapabilities {
    return getProviderCapabilities("bullmq");
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

  async getPrefixes(): Promise<string[]> {
    return this.getActivePrefixes();
  }

  async getQueues(): Promise<IQueue[]> {
    const discovered = await this.discoverQueues();
    const queues = await Promise.all(
      discovered.map((q) =>
        this.getQueue(q.name, q.prefix),
      ),
    );
    return queues.filter(
      (q): q is IQueue => q !== null,
    );
  }

  async getQueue(
    name: string,
    prefix?: string,
  ): Promise<IQueue | null> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(name, pfx);
    const [isPaused, jobCounts] = await Promise.all([
      queue.isPaused(),
      this.getJobCounts(name, pfx),
    ]);

    return {
      name,
      prefix: pfx,
      isPaused,
      jobCounts,
    };
  }

  async getJobCounts(
    queueName: string,
    prefix?: string,
  ): Promise<JobCounts> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(queueName, pfx);
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

  async pauseQueue(
    queueName: string, prefix?: string,
  ): Promise<void> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
    await queue.pause();
  }

  async resumeQueue(
    queueName: string, prefix?: string,
  ): Promise<void> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
    await queue.resume();
  }

  async getJobs(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<Job[]> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
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

  // https://github.com/taskforcesh/bullmq/blob/master/src/classes/queue-getters.ts#L456
  private sanitizeJobTypes(types: JobType[] | JobType | undefined): JobType[] {
    const currentTypes = typeof types === "string" ? [types] : types;

    if (Array.isArray(currentTypes) && currentTypes.length > 0) {
      const sanitizedTypes = [...currentTypes];

      if (sanitizedTypes.indexOf("waiting") !== -1) {
        sanitizedTypes.push("paused");
      }

      return [...new Set(sanitizedTypes)];
    }

    return [
      "active",
      "completed",
      "delayed",
      "failed",
      "paused",
      "prioritized",
      "waiting",
      "waiting-children",
    ];
  }

  private async getJobMetaFromKey(
    queue: Queue,
    jobId: string,
    jobKey: string,
  ): Promise<JobSummary | null> {
    const client = await queue.client;
    const [
      name,
      timestamp,
      progress,
      attemptsMade,
      processedOn,
      finishedOn,
      failedReason,
      delay,
      priority,
      parent,
    ] = await client.hmget(
      jobKey,
      "name",
      "timestamp",
      "progress",
      "attemptsMade",
      "processedOn",
      "finishedOn",
      "failedReason",
      "delay",
      "priority",
      "parent",
    );

    const jobStatus = await queue.getJobState(jobId);

    // Check if job has parent
    let parentId: string | undefined;
    if (parent) {
      const parentData = JSON.parse(parent);
      parentId = parentData.id;
    }

    return {
      id: jobId,
      name: name || "",
      queueName: queue.name,
      status: jobStatus as JobStatus,
      timestamp: timestamp ? parseInt(timestamp, 10) : 0,
      progress: progress ? this.normalizeProgress(progress) : 0,
      attemptsMade: attemptsMade ? parseInt(attemptsMade, 10) : 0,
      processedOn: processedOn ? parseInt(processedOn, 10) : undefined,
      finishedOn: finishedOn ? parseInt(finishedOn, 10) : undefined,
      failedReason: failedReason || undefined,
      delay: delay ? parseInt(delay, 10) : undefined,
      priority: priority ? parseInt(priority, 10) : undefined,
      parentId: parentId,
    };
  }

  // Works similar to queue.getJobs but skips fetching the full job objects and instead retrieves only the metadata needed for summaries directly from Redis hashes. This is much faster and lighter when we only need summary info for many jobs.
  private async getJobsTrimmed(
    queue: Queue,
    types?: JobType[],
    start: number = 0,
    end: number = -1,
    asc: boolean = false,
  ) {
    const sanitizedTypes = this.sanitizeJobTypes(types);
    const jobIds = await queue.getRanges(sanitizedTypes, start, end, asc);

    const promises = jobIds.map(async (id) => {
      const jobKey = queue.toKey(id);
      const meta = await this.getJobMetaFromKey(queue, id, jobKey);
      return meta;
    });

    const jobs = await Promise.all(promises);

    const filtered = jobs.filter((job): job is JobSummary => job !== null);

    return filtered;
  }

  async getJobsSummary(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<JobSummary[]> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
    const { filter, sort, limit = 100, offset = 0 } = options ?? {};

    const statuses = this.resolveStatuses(filter?.status);

    const jobs = await this.getJobsTrimmed(
      queue,
      statuses,
      offset,
      offset + limit - 1,
    );

    let mappedJobs = jobs;
    if (filter?.name) {
      mappedJobs = mappedJobs.filter((job) => job.name === filter.name);
    }

    if (sort) {
      mappedJobs = this.sortJobSummaries(mappedJobs, sort.field, sort.order);
    }

    return mappedJobs;
  }

  async getJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<Job | null> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return this.mapJob(job, state, queueName);
  }

  async getJobLogs(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<{ logs: string[]; count: number }> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
    return queue.getJobLogs(jobId);
  }

  async retryJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<void> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new JobNotFoundError(queueName, jobId);
    }

    await job.retry();
  }

  async removeJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<void> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new JobNotFoundError(queueName, jobId);
    }

    await job.remove();
  }

  async getWorkerCount(
    queueName: string,
    prefix?: string,
  ): Promise<WorkerCount> {
    const pfx = prefix ?? this.defaultPrefix;
    const queue = this.getOrCreateQueue(
      queueName, pfx,
    );
    const workers = await queue.getWorkers();

    return {
      queueName,
      count: workers.length,
    };
  }

  private getOrCreateQueue(
    name: string,
    prefix: string,
  ): Queue {
    const key = this.queueKey(prefix, name);
    let queue = this.queues.get(key);
    if (!queue) {
      if (!this.connection) {
        throw new NotConnectedError();
      }
      queue = new Queue(name, {
        connection: this.connection,
        prefix,
      });
      this.queues.set(key, queue);
    }
    return queue;
  }

  private async discoverQueues(): Promise<
    { name: string; prefix: string }[]
  > {
    if (!this.connection) {
      throw new NotConnectedError();
    }

    const prefixes = await this.getActivePrefixes();
    const result: { name: string; prefix: string }[] =
      [];
    const seen = new Set<string>();

    for (const prefix of prefixes) {
      const pattern = `${prefix}:*:meta`;
      let cursor = "0";
      do {
        const [next, keys] =
          await this.connection.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            100,
          );
        cursor = next;
        for (const key of keys) {
          const name = parseQueueNameFromKey(
            key,
            prefix,
            "meta",
          );
          if (!name) continue;
          const composite =
            this.queueKey(prefix, name);
          if (seen.has(composite)) continue;
          seen.add(composite);
          result.push({ name, prefix });
        }
      } while (cursor !== "0");
    }

    return result;
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
