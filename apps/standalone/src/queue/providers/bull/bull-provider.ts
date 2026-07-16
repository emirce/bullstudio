import { createBullQueueAdapter } from "@bullstudio/bull-adapter";
import type {
  AddJobInput,
  Queue as IQueue,
  Job,
  JobCounts,
  JobQueryOptions,
  JobScheduler,
  JobSchedulerTarget,
  JobSummary,
  QueueAdapter,
  QueueMetricSnapshot,
  QueueMetricType,
  UpsertJobSchedulerInput,
  Worker,
  WorkerCount,
} from "@bullstudio/connect-types";
import Bull from "bull";
import { resolveConfiguredPrefixes } from "../../detection/prefix-discovery";
import { NotConnectedError } from "../../errors";
import type {
  QueueProviderCapabilities,
  QueueProviderType,
  QueueService,
  QueueServiceConfig,
  QueueServiceEventCallbacks,
} from "../../types";
import { getProviderCapabilities } from "../../types";
import {
  createRedisConnection,
  type RedisConnection,
  redisReconnectStrategy,
  scanMatching,
} from "../../utils";
import { parseQueueNameFromKey } from "../redis-key";

const DEFAULT_PREFIX = "bull";

export class BullProvider implements QueueService {
  readonly providerType: QueueProviderType = "bull";
  readonly cluster: boolean;

  private readonly config: QueueServiceConfig;
  private readonly eventCallbacks: QueueServiceEventCallbacks;
  private connection: RedisConnection | null = null;
  private queues = new Map<string, Bull.Queue>();
  private queueAdapters = new Map<string, QueueAdapter>();
  private _isConnected = false;
  private _isReconnecting = false;

  constructor(config: QueueServiceConfig) {
    this.cluster = config.cluster ?? false;
    this.config = {
      prefix: DEFAULT_PREFIX,
      ...config,
    };
    this.eventCallbacks = config.eventCallbacks ?? {};
  }

  private resolvedPrefixes: string[] | null = null;

  private queueKey(prefix: string, name: string): string {
    return `${prefix}\0${name}`;
  }

  private get defaultPrefix(): string {
    if (this.config.prefix) {
      return this.config.prefix;
    }
    const explicit = this.config.prefixes?.filter((p) => p !== "*");
    if (explicit?.length === 1) {
      const [prefix] = explicit;
      return prefix ?? DEFAULT_PREFIX;
    }
    return DEFAULT_PREFIX;
  }

  /**
   * Resolve (and memoize) the prefixes to scan from the configured ones,
   * expanding `*` (all prefixes) and glob patterns like `local:{*}` against
   * Redis. Falls back to the default prefix when none are configured.
   *
   * @returns The concrete prefixes to scan for this provider.
   */
  private async getActivePrefixes(): Promise<string[]> {
    if (this.resolvedPrefixes) {
      return this.resolvedPrefixes;
    }
    const configured = this.config.prefixes;
    const hasPattern = configured?.some((p) => p.includes("*")) ?? false;
    if (hasPattern && this.connection) {
      // Expand "*" (all prefixes) and globs like "local:{*}" against Redis.
      this.resolvedPrefixes = await resolveConfiguredPrefixes(
        this.connection,
        configured,
        this.defaultPrefix,
      );
    } else if (configured && configured.length > 0 && !hasPattern) {
      this.resolvedPrefixes = configured;
    } else {
      this.resolvedPrefixes = [this.defaultPrefix];
    }
    return this.resolvedPrefixes;
  }

  getCapabilities(): QueueProviderCapabilities {
    return getProviderCapabilities("bull");
  }

  async connect(): Promise<void> {
    if (this._isConnected) {
      return;
    }

    // Cluster mode (detected by the provider factory) connects with a cluster
    // client seeded from the URL; single-node mode keeps a plain client.
    this.connection = createRedisConnection(this.config.redisUrl, {
      cluster: this.config.cluster,
      enableReadyCheck: true,
      lazyConnect: true,
      // Auto-reconnect with backoff so a dropped connection self-heals once
      // Redis comes back. The initial connect still fails fast (ioredis only
      // consults retryStrategy after an established connection drops).
      retryStrategy: redisReconnectStrategy,
      // Bound reads so a request issued while Redis is down fails fast instead
      // of hanging on the offline queue forever. These are non-blocking reads.
      commandTimeout: 10000,
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
        // Re-resolve prefixes after a reconnect: new queues/prefixes may have
        // appeared while disconnected.
        this.resolvedPrefixes = null;
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
    this.queueAdapters.clear();

    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }

    this._isConnected = false;
    // Drop memoized prefixes so a fresh connection re-resolves them.
    this.resolvedPrefixes = null;
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
      discovered.map((q) => this.getQueue(q.name, q.prefix)),
    );
    return queues.filter((q): q is IQueue => q !== null);
  }

  async getQueue(name: string, prefix?: string): Promise<IQueue | null> {
    return this.getOrCreateQueueAdapter(name, prefix).getQueue();
  }

  async getJobCounts(queueName: string, prefix?: string): Promise<JobCounts> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJobCounts();
  }

  async pauseQueue(queueName: string, prefix?: string): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).pauseQueue();
  }

  async resumeQueue(queueName: string, prefix?: string): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).resumeQueue();
  }

  async drainQueue(queueName: string, prefix?: string): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).drainQueue();
  }

  async getJobs(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<Job[]> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJobs(options);
  }

  async getJobsSummary(
    queueName: string,
    options?: JobQueryOptions,
    prefix?: string,
  ): Promise<JobSummary[]> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJobsSummary(
      options,
    );
  }

  async getMetrics(
    queueName: string,
    type: QueueMetricType,
    prefix?: string,
  ): Promise<QueueMetricSnapshot | null> {
    const adapter = this.getOrCreateQueueAdapter(queueName, prefix);
    return adapter.getMetrics ? adapter.getMetrics(type) : null;
  }

  async getJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<Job | null> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJob(jobId);
  }

  async getJobLogs(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<{ logs: string[]; count: number }> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getJobLogs(jobId);
  }

  async retryJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).retryJob(jobId);
  }

  async retryFailedJobs(queueName: string, prefix?: string): Promise<number> {
    return this.getOrCreateQueueAdapter(queueName, prefix).retryFailedJobs();
  }

  async removeJob(
    queueName: string,
    jobId: string,
    prefix?: string,
  ): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).removeJob(jobId);
  }

  async addJob(
    queueName: string,
    input: AddJobInput,
    prefix?: string,
  ): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).addJob?.(input);
  }

  async getWorkerCount(
    queueName: string,
    prefix?: string,
  ): Promise<WorkerCount> {
    return this.getOrCreateQueueAdapter(queueName, prefix).getWorkerCount();
  }

  async listWorkers(queueName: string, prefix?: string): Promise<Worker[]> {
    return (
      this.getOrCreateQueueAdapter(queueName, prefix).listWorkers?.() ?? []
    );
  }

  async listJobSchedulers(
    queueName: string,
    options?: { limit?: number },
    prefix?: string,
  ): Promise<JobScheduler[]> {
    return (
      this.getOrCreateQueueAdapter(queueName, prefix).listJobSchedulers?.(
        options,
      ) ?? []
    );
  }

  async getJobScheduler(
    queueName: string,
    target: JobSchedulerTarget,
    prefix?: string,
  ): Promise<JobScheduler | null> {
    return (
      this.getOrCreateQueueAdapter(queueName, prefix).getJobScheduler?.(
        target,
      ) ?? null
    );
  }

  async upsertJobScheduler(
    queueName: string,
    input: UpsertJobSchedulerInput,
    prefix?: string,
  ): Promise<void> {
    await this.getOrCreateQueueAdapter(queueName, prefix).upsertJobScheduler?.(
      input,
    );
  }

  async removeJobScheduler(
    queueName: string,
    target: JobSchedulerTarget,
    prefix?: string,
  ): Promise<boolean> {
    return (
      this.getOrCreateQueueAdapter(queueName, prefix).removeJobScheduler?.(
        target,
      ) ?? false
    );
  }

  private getOrCreateQueueAdapter(name: string, prefix?: string): QueueAdapter {
    const pfx = prefix ?? this.defaultPrefix;
    const key = this.queueKey(pfx, name);
    let adapter = this.queueAdapters.get(key);
    if (!adapter) {
      adapter = createBullQueueAdapter(this.getOrCreateQueue(name, pfx), {
        key,
        label: name,
      });
      this.queueAdapters.set(key, adapter);
    }
    return adapter;
  }

  private getOrCreateQueue(name: string, prefix: string): Bull.Queue {
    const key = this.queueKey(prefix, name);
    let queue = this.queues.get(key);
    if (!queue) {
      if (!this.connection) {
        throw new NotConnectedError();
      }
      const connection = this.connection;

      queue = new Bull(name, {
        createClient: (type) => {
          if (type === "client") {
            return connection.duplicate();
          }
          return createRedisConnection(this.config.redisUrl, {
            cluster: this.config.cluster,
            enableReadyCheck: true,
            retryStrategy: redisReconnectStrategy,
          });
        },
        prefix,
      });
      // Bull's Queue re-emits Redis connection errors on itself. Without a
      // listener Node treats an emitted "error" as fatal and crashes the
      // process, so swallow it here — connection state is tracked on the
      // shared connection's own listeners.
      queue.on("error", (error) => {
        console.error(`[BullProvider] Queue "${name}" error:`, error.message);
      });
      this.queues.set(key, queue);
    }
    return queue;
  }

  private async discoverQueues(): Promise<{ name: string; prefix: string }[]> {
    if (!this.connection) {
      throw new NotConnectedError();
    }

    const prefixes = await this.getActivePrefixes();
    const result: { name: string; prefix: string }[] = [];
    const seen = new Set<string>();

    for (const prefix of prefixes) {
      await scanMatching(this.connection, `${prefix}:*:id`, (key) => {
        const name = parseQueueNameFromKey(key, prefix, "id");
        if (!name) return;
        const composite = this.queueKey(prefix, name);
        if (seen.has(composite)) return;
        seen.add(composite);
        result.push({ name, prefix });
      });
    }

    return result;
  }
}
