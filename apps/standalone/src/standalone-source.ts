import type {
  FlowNode,
  FlowSummary,
  FlowTree,
  Job,
  JobScheduler,
  JobStatus,
  JobSummary,
  Worker,
} from "@bullstudio/connect-types";
import {
  type DashboardQueue,
  type FlowListInput,
  type FlowTargetInput,
  type JobAddInput,
  type JobListInput,
  type JobRetryAllResponse,
  type JobTargetInput,
  type PrivateDashboardQueueSource,
  type QueueMetricsListInput,
  type QueueMetricsSummary,
  type QueueSourceStatus,
  type QueueTargetInput,
  type SchedulerTargetInput,
  type SchedulerUpsertInput,
  supportedJobStatuses,
  type WorkerListInput,
} from "@bullstudio/private-router";
import { TRPCError } from "@trpc/server";
import type { FlowProducer, JobNode } from "bullmq";
import { getFlowProducer, getQueueProvider } from "./connection";

export function createStandaloneQueueSource(): PrivateDashboardQueueSource {
  return {
    mode: "standalone",
    readOnly: false,
    getStatus: getStandaloneQueueSourceStatus,
    listQueues: async () => {
      const provider = await getQueueProvider();
      return provider.getQueues();
    },
    listPrefixes: async () => {
      const provider = await getQueueProvider();
      return provider.getPrefixes();
    },
    resolveQueue,
    listJobs: async (input) => {
      const provider = await getQueueProvider();
      const queues = await getQueuesForListInput(input);
      const jobs: Job[] = [];

      for (const queue of queues) {
        const queueJobs = await provider.getJobs(
          queue.name,
          getQueueJobQueryOptions(input),
          queue.prefix,
        );
        jobs.push(
          ...queueJobs.map((job) => ({
            ...job,
            prefix: job.prefix ?? queue.prefix,
          })),
        );
      }

      return jobs;
    },
    listJobSummaries: async (input) => {
      const provider = await getQueueProvider();
      const queues = await getQueuesForListInput(input);
      const jobs: JobSummary[] = [];

      for (const queue of queues) {
        const queueJobs = await provider.getJobsSummary(
          queue.name,
          getQueueJobQueryOptions(input),
          queue.prefix,
        );
        jobs.push(
          ...queueJobs.map((job) => ({
            ...job,
            prefix: job.prefix ?? queue.prefix,
          })),
        );
      }

      return jobs;
    },
    listQueueMetrics,
    getJob: async (input) => {
      const provider = await getQueueProvider();
      const queue = await resolveQueue(input);
      return provider.getJob(queue.name, input.jobId, queue.prefix);
    },
    getJobLogs: async (input) => {
      const provider = await getQueueProvider();
      const queue = await resolveQueue(input);
      return provider.getJobLogs(queue.name, input.jobId, queue.prefix);
    },
    retryJob: retryJob,
    retryAllFailedJobs: retryAllFailedJobs,
    removeJob: removeJob,
    addJob: addJob,
    pauseQueue: async (input) => {
      const provider = await getQueueProvider();
      const queue = await resolveQueue(input);
      await provider.pauseQueue(queue.name, queue.prefix);
      return { success: true };
    },
    resumeQueue: async (input) => {
      const provider = await getQueueProvider();
      const queue = await resolveQueue(input);
      await provider.resumeQueue(queue.name, queue.prefix);
      return { success: true };
    },
    drainQueue: async (input) => {
      const provider = await getQueueProvider();
      const queue = await resolveQueue(input);
      await provider.drainQueue(queue.name, queue.prefix);
      return { success: true };
    },
    listFlows,
    getFlow,
    getJobFlow,
    listWorkers: async (input) => {
      const provider = await getQueueProvider();
      const queues = await getQueuesForWorkerList(input);
      const workers: Worker[] = [];

      for (const queue of queues) {
        const queueWorkers = await provider.listWorkers(
          queue.name,
          queue.prefix,
        );
        workers.push(
          ...queueWorkers.map((worker) => ({
            ...worker,
            prefix: worker.prefix ?? queue.prefix,
            queueKey: queue.key,
            provider: worker.provider ?? queue.provider,
          })),
        );
      }

      return workers.slice(0, input.limit ?? 200);
    },
    getWorker: async (input) => {
      const provider = await getQueueProvider();
      const queue = await resolveQueue(input);
      const workers = await provider.listWorkers(queue.name, queue.prefix);
      return (
        workers
          .map((worker) => ({
            ...worker,
            prefix: worker.prefix ?? queue.prefix,
            queueKey: queue.key,
            provider: worker.provider ?? queue.provider,
          }))
          .find((worker) => worker.id === input.workerId) ?? null
      );
    },
    listJobSchedulers: async (input) => {
      const provider = await getQueueProvider();
      const queues = await getQueuesForListInput(input);
      const schedulers: JobScheduler[] = [];

      for (const queue of queues) {
        const queueSchedulers = await provider.listJobSchedulers(
          queue.name,
          { limit: input.limit },
          queue.prefix,
        );
        schedulers.push(
          ...queueSchedulers.map((scheduler) => ({
            ...scheduler,
            prefix: scheduler.prefix ?? queue.prefix,
          })),
        );
      }

      return schedulers
        .sort((a, b) => (a.next ?? Infinity) - (b.next ?? Infinity))
        .slice(0, input.limit ?? 100);
    },
    getJobScheduler: async (input) => {
      const provider = await getQueueProvider();
      const queue = await resolveQueue(input);
      return provider.getJobScheduler(
        queue.name,
        { key: input.schedulerKey, id: input.schedulerId },
        queue.prefix,
      );
    },
    upsertJobScheduler,
    removeJobScheduler,
  };
}

async function getStandaloneQueueSourceStatus(): Promise<QueueSourceStatus> {
  const connection = getRedisConnectionInfo();

  try {
    const provider = await getQueueProvider();
    const capabilities = provider.getCapabilities();
    const prefixes = await provider.getPrefixes();

    return {
      mode: "standalone",
      source: "redis",
      // Reflect the live connection state instead of always reporting healthy.
      // The provider auto-reconnects, so a dropped connection shows as degraded
      // until it recovers rather than falsely reporting connected.
      status: provider.isConnected() ? "healthy" : "degraded",
      connection,
      providers: [capabilities.providerType],
      prefixes,
      capabilities: {
        flows: capabilities.supportsFlows,
        schedulers: capabilities.supportsSchedulers,
        workers: true,
        supportedStatuses: capabilities.supportedJobStates,
        mutationsAllowed: true,
      },
    };
  } catch {
    // Redis is unreachable (e.g. down at startup). Report unavailable rather
    // than letting the status query throw, so the sidebar can surface the
    // outage. The status query keeps polling and recovers once Redis is back.
    return {
      mode: "standalone",
      source: "redis",
      status: "unavailable",
      connection,
      providers: [],
      prefixes: [],
      capabilities: {
        flows: false,
        schedulers: false,
        workers: false,
        supportedStatuses: [],
        mutationsAllowed: false,
      },
    };
  }
}

function getRedisConnectionInfo() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    const parsed = new URL(redisUrl);
    const host = parsed.hostname || "localhost";
    const port = parsed.port || "6379";

    return {
      host,
      port,
      hasPassword: Boolean(parsed.password),
      database: parsed.pathname.slice(1) || "0",
      displayUrl: `${host}:${port}`,
    };
  } catch {
    return {
      host: "localhost",
      port: "6379",
      hasPassword: false,
      database: "0",
      displayUrl: "localhost:6379",
    };
  }
}

async function resolveQueue(input: QueueTargetInput): Promise<DashboardQueue> {
  const name = input.name ?? input.queueName ?? input.queueKey;

  if (!name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A queueKey string or queue name string is required.",
    });
  }

  const provider = await getQueueProvider();
  const queue = await provider.getQueue(name, input.prefix);

  if (!queue) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Queue ${formatQueueLookup(name, input.prefix)} not found`,
    });
  }

  return queue;
}

async function getQueuesForListInput(
  input: JobListInput,
): Promise<DashboardQueue[]> {
  if (input.queueKey || input.queueName) {
    return [await resolveQueue(input)];
  }

  const provider = await getQueueProvider();
  return provider.getQueues();
}

async function listQueueMetrics(
  input: QueueMetricsListInput,
): Promise<QueueMetricsSummary[]> {
  const provider = await getQueueProvider();
  const queues = await getQueuesForListInput(input);

  return Promise.all(
    queues.map(async (queue) => {
      const [completed, failed] = await Promise.all([
        provider.getMetrics(queue.name, "completed", queue.prefix),
        provider.getMetrics(queue.name, "failed", queue.prefix),
      ]);

      return {
        queueKey: queue.key,
        queueName: queue.name,
        prefix: queue.prefix,
        completed,
        failed,
      };
    }),
  );
}

async function getQueuesForWorkerList(
  input: WorkerListInput,
): Promise<DashboardQueue[]> {
  if (input.queueKey || input.queueName) {
    return [await resolveQueue(input)];
  }

  const provider = await getQueueProvider();
  return provider.getQueues();
}

function getQueueJobQueryOptions(input: JobListInput) {
  return {
    filter: input.status ? { status: input.status } : undefined,
    limit: input.limit,
    offset: input.offset,
  };
}

async function retryJob(
  input: JobTargetInput,
): Promise<{ success: true; message: string; workerCount: number }> {
  const provider = await getQueueProvider();
  const queue = await resolveQueue(input);
  const job = await provider.getJob(queue.name, input.jobId, queue.prefix);

  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Job ${input.jobId} not found in queue ${queue.name}`,
    });
  }

  if (job.status !== "failed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Job is not in failed state. Current status: ${job.status}`,
    });
  }

  const workerCount = await provider.getWorkerCount(queue.name, queue.prefix);
  if (workerCount.count === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        `No workers available for queue "${queue.name}". ` +
        "Start a worker to process retried jobs.",
    });
  }

  await provider.retryJob(queue.name, input.jobId, queue.prefix);

  return {
    success: true,
    message: `Job "${job.name}" has been enqueued for retry`,
    workerCount: workerCount.count,
  };
}

async function retryAllFailedJobs(
  input: QueueTargetInput,
): Promise<JobRetryAllResponse> {
  const provider = await getQueueProvider();
  const queue = await resolveQueue(input);

  const workerCount = await provider.getWorkerCount(queue.name, queue.prefix);
  if (workerCount.count === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        `No workers available for queue "${queue.name}". ` +
        "Start a worker to process retried jobs.",
    });
  }

  const count = await provider.retryFailedJobs(queue.name, queue.prefix);

  return {
    success: true,
    message:
      count === 0
        ? "No failed jobs to retry"
        : `Re-enqueued ${count} failed job${count === 1 ? "" : "s"}`,
    count,
    workerCount: workerCount.count,
  };
}

async function removeJob(
  input: JobTargetInput,
): Promise<{ success: true; message: string }> {
  const provider = await getQueueProvider();
  const queue = await resolveQueue(input);
  const job = await provider.getJob(queue.name, input.jobId, queue.prefix);

  if (!job) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Job ${input.jobId} not found in queue ${queue.name}`,
    });
  }

  await provider.removeJob(queue.name, input.jobId, queue.prefix);

  return {
    success: true,
    message: `Job "${job.name}" has been removed`,
  };
}

async function addJob(
  input: JobAddInput,
): Promise<{ success: true; message: string }> {
  const provider = await getQueueProvider();
  const queue = await resolveQueue(input);

  await provider.addJob(
    queue.name,
    {
      name: input.jobName,
      data: input.data,
      opts: { delay: input.delay, attempts: input.attempts },
    },
    queue.prefix,
  );

  return {
    success: true,
    message: `Job "${input.jobName}" has been added to queue "${queue.name}"`,
  };
}

async function upsertJobScheduler(
  input: SchedulerUpsertInput,
): Promise<{ success: true; message: string }> {
  const provider = await getQueueProvider();
  const queue = await resolveQueue(input);

  await provider.upsertJobScheduler(
    queue.name,
    {
      schedulerId: input.schedulerId,
      previousKey: input.previousKey,
      repeat: input.repeat,
      template: input.template,
    },
    queue.prefix,
  );

  return {
    success: true,
    message: `Scheduler "${input.schedulerId}" has been saved`,
  };
}

async function removeJobScheduler(
  input: SchedulerTargetInput,
): Promise<{ success: true; message: string }> {
  const provider = await getQueueProvider();
  const queue = await resolveQueue(input);

  await provider.removeJobScheduler(
    queue.name,
    { key: input.schedulerKey, id: input.schedulerId },
    queue.prefix,
  );

  return {
    success: true,
    message: `Scheduler "${input.schedulerId ?? input.schedulerKey}" has been removed`,
  };
}

async function listFlows(input: FlowListInput): Promise<FlowSummary[]> {
  const provider = await getQueueProvider();
  const capabilities = provider.getCapabilities();

  if (!capabilities.supportsFlows) {
    return [];
  }

  const limit = input?.limit ?? 50;
  const producer = await getFlowProducer();
  const queues =
    input?.queueKey || input?.queueName
      ? [await resolveQueue(input)]
      : await provider.getQueues();
  const flows: FlowSummary[] = [];
  const seenJobIds = new Set<string>();

  for (const queue of queues) {
    if (flows.length >= limit) {
      break;
    }

    const jobs = await provider.getJobsSummary(
      queue.name,
      { limit: 500 },
      queue.prefix,
    );

    for (const job of jobs.filter((job) => !job.parentId)) {
      if (flows.length >= limit) {
        break;
      }

      const jobKey = `${queue.prefix}:${job.queueName}:${job.id}`;
      if (seenJobIds.has(jobKey)) {
        continue;
      }
      seenJobIds.add(jobKey);

      const flow = await getFlowSummary(producer, job, queue.prefix);
      if (flow) {
        flows.push(flow);
      }
    }
  }

  for (const queue of queues) {
    if (flows.length >= limit) {
      break;
    }

    const waitingChildrenJobs = await provider.getJobs(
      queue.name,
      {
        filter: {
          status: "waiting-children",
        },
        limit: 100,
      },
      queue.prefix,
    );

    for (const job of waitingChildrenJobs) {
      if (flows.length >= limit) {
        break;
      }

      if (job.parentId) {
        continue;
      }

      const jobKey = `${queue.prefix}:${job.queueName}:${job.id}`;
      if (seenJobIds.has(jobKey)) {
        continue;
      }
      seenJobIds.add(jobKey);

      const flow = await getFlowSummary(producer, job, queue.prefix);
      if (flow) {
        flows.push(flow);
      }
    }
  }

  return flows.sort((a, b) => b.timestamp - a.timestamp);
}

async function getFlow(input: FlowTargetInput): Promise<FlowTree | null> {
  const provider = await getQueueProvider();
  const capabilities = provider.getCapabilities();

  if (!capabilities.supportsFlows) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Flows are not supported by this queue provider (Bull)",
    });
  }

  const queue = await resolveQueue(input);
  const producer = await getFlowProducer();

  try {
    const flowTree = await producer.getFlow({
      id: input.flowId,
      queueName: queue.name,
      prefix: queue.prefix,
    });

    if (!flowTree) {
      return null;
    }

    const root = await convertFlowTree(flowTree);
    const stats = await countFlowStats(flowTree);

    return {
      id: input.flowId,
      root,
      queueName: queue.name,
      totalNodes: stats.total,
      completedNodes: stats.completed,
      failedNodes: stats.failed,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    return null;
  }
}

async function getJobFlow(input: JobTargetInput): Promise<FlowTree | null> {
  const provider = await getQueueProvider();
  const capabilities = provider.getCapabilities();

  if (!capabilities.supportsFlows) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Flows are not supported by this queue provider (Bull)",
    });
  }

  const queue = await resolveQueue(input);
  const producer = await getFlowProducer();

  try {
    // `producer.getFlow` only walks down to children, so climb the parentKey
    // chain (which can cross queues) to the flow root before building the tree.
    let rootNode = await producer.getFlow({
      id: input.jobId,
      queueName: queue.name,
      prefix: queue.prefix,
    });
    if (!rootNode) {
      return null;
    }

    let rootId = input.jobId;
    let rootQueueName = queue.name;
    let parentKey = rootNode.job.parentKey;

    while (parentKey) {
      const parsed = parseFlowJobKey(parentKey);
      if (!parsed) {
        break;
      }
      const parentNode = await producer.getFlow(parsed);
      if (!parentNode) {
        break;
      }
      rootNode = parentNode;
      rootId = parsed.id;
      rootQueueName = parsed.queueName;
      parentKey = parentNode.job.parentKey;
    }

    const root = await convertFlowTree(rootNode);
    const stats = await countFlowStats(rootNode);

    return {
      id: rootId,
      root,
      queueName: rootQueueName,
      totalNodes: stats.total,
      completedNodes: stats.completed,
      failedNodes: stats.failed,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    return null;
  }
}

/**
 * Parse a BullMQ parent job key (`<prefix>:<queueName>:<jobId>`). Prefixes may
 * contain colons, so only the last two segments are the queue name and job id.
 */
function parseFlowJobKey(
  key: string,
): { prefix: string; queueName: string; id: string } | null {
  const parts = key.split(":");
  if (parts.length < 3) {
    return null;
  }
  const id = parts.pop() as string;
  const queueName = parts.pop() as string;
  return { prefix: parts.join(":"), queueName, id };
}

async function getFlowSummary(
  producer: FlowProducer,
  job: JobSummary | Job,
  prefix: string | undefined,
): Promise<FlowSummary | null> {
  try {
    const flowTree = await producer.getFlow({
      id: job.id,
      queueName: job.queueName,
      prefix,
    });

    if (!flowTree?.children || flowTree.children.length === 0) {
      return null;
    }

    const stats = await countFlowStats(flowTree);
    const state = await flowTree.job.getState();

    return {
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      prefix,
      status: state as JobStatus,
      totalJobs: stats.total,
      completedJobs: stats.completed,
      failedJobs: stats.failed,
      timestamp: job.timestamp,
    };
  } catch {
    return null;
  }
}

async function countFlowStats(tree: JobNode): Promise<{
  total: number;
  completed: number;
  failed: number;
}> {
  let total = 1;
  let completed = 0;
  let failed = 0;
  const state = await tree.job.getState();

  if (state === "completed") {
    completed = 1;
  } else if (state === "failed") {
    failed = 1;
  }

  if (tree.children) {
    for (const child of tree.children) {
      const childStats = await countFlowStats(child);
      total += childStats.total;
      completed += childStats.completed;
      failed += childStats.failed;
    }
  }

  return { total, completed, failed };
}

async function convertFlowTree(tree: JobNode): Promise<FlowNode> {
  const job = tree.job;
  const state = await job.getState();
  const children: FlowNode[] = [];

  if (tree.children && tree.children.length > 0) {
    for (const child of tree.children) {
      children.push(await convertFlowTree(child));
    }
  }

  return {
    id: job.id || "",
    name: job.name,
    queueName: job.queueName,
    status: normalizeJobStatus(state),
    data: job.data,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
    children,
  };
}

function normalizeJobStatus(status: string): JobStatus {
  return supportedJobStatuses.includes(status as JobStatus)
    ? (status as JobStatus)
    : "waiting";
}

function formatQueueLookup(name: string, prefix: string | undefined): string {
  return prefix ? `${prefix}/${name}` : name;
}
