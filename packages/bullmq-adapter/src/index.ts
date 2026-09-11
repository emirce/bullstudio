import {
  createJobNotFoundError,
  createWorkerCount,
  filterJobsByName,
  mapRedisClientWorker,
  normalizeJobCounts,
  sortJobs,
  toJobSummary,
} from "@bullstudio/adapter-utils";
import type {
  FlowNode,
  FlowSummary,
  FlowTree,
  Job,
  JobQueryOptions,
  JobScheduler,
  JobSchedulerRepeat,
  JobStatus,
  JobSummary,
  QueueAdapter,
} from "@bullstudio/connect-types";
import {
  type Job as BullMqJob,
  FlowProducer,
  type JobNode,
  type JobSchedulerJson,
  type JobType,
  type Queue,
  type RepeatOptions,
} from "bullmq";

export interface BullMqQueueAdapterOptions {
  key?: string;
  label?: string;
}

export function createBullMqQueueAdapter(
  queue: Queue,
  options: BullMqQueueAdapterOptions = {},
): QueueAdapter {
  const flowProducer = new FlowProducer({
    connection: queue.opts?.connection,
    prefix: getQueuePrefix(queue),
  });

  return {
    key: options.key ?? queue.name,
    label: options.label ?? queue.name,
    provider: "bullmq",
    capabilities: {
      flows: true,
      jobLogs: true,
      jobRemoval: true,
      jobRetry: true,
      queuePause: true,
      queueResume: true,
      queueDrain: true,
      queueAddJob: true,
      schedulers: true,
      workers: true,
    },
    getQueue: async () => {
      const [isPaused, jobCounts] = await Promise.all([
        queue.isPaused(),
        getJobCounts(queue),
      ]);

      return {
        name: queue.name,
        prefix: getQueuePrefix(queue),
        isPaused,
        jobCounts,
      };
    },
    getJobCounts: () => getJobCounts(queue),
    pauseQueue: async () => {
      await queue.pause();
    },
    resumeQueue: async () => {
      await queue.resume();
    },
    drainQueue: async () => {
      await queue.drain(true);
    },
    addJob: async (input) => {
      await queue.add(input.name, input.data ?? {}, input.opts);
    },
    getJobs: async (options) => {
      const { filter, sort, limit = 100, offset = 0 } = options ?? {};
      const jobs = await queue.getJobs(
        resolveStatuses(filter?.status),
        offset,
        offset + limit - 1,
      );
      let mappedJobs = await Promise.all(
        jobs
          .filter((job): job is BullMqJob => job !== undefined)
          .map((job) => mapJob(job, queue.name)),
      );

      mappedJobs = filterJobsByName(mappedJobs, filter?.name);

      if (sort) {
        mappedJobs = sortJobs(mappedJobs, sort.field, sort.order);
      }

      return mappedJobs;
    },
    getJobsSummary: async (options) => {
      const summaries = await getJobsTrimmed(
        queue,
        resolveStatuses(options?.filter?.status),
        options?.offset ?? 0,
        (options?.offset ?? 0) + (options?.limit ?? 100) - 1,
      );
      let filteredSummaries = filterJobsByName(
        summaries,
        options?.filter?.name,
      );

      if (options?.sort) {
        filteredSummaries = sortJobs(
          filteredSummaries,
          options.sort.field,
          options.sort.order,
        );
      }

      return filteredSummaries;
    },
    getMetrics: (type) => queue.getMetrics(type),
    getJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      return job ? mapJob(job, queue.name) : null;
    },
    getJobLogs: (jobId) => queue.getJobLogs(jobId),
    retryJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw createJobNotFoundError(queue.name, jobId);
      }
      await job.retry();
    },
    retryFailedJobs: async () => {
      let total = 0;
      // BullMQ retries up to `count` failed jobs per call, so loop in batches
      // until the failed set is drained (or stops shrinking, e.g. jobs re-fail).
      for (;;) {
        const before = await queue.getJobCountByTypes("failed");
        if (before === 0) {
          break;
        }
        await queue.retryJobs({ state: "failed", count: 1000 });
        const after = await queue.getJobCountByTypes("failed");
        total += Math.max(0, before - after);
        if (after === 0 || after >= before) {
          break;
        }
      }
      return total;
    },
    removeJob: async (jobId) => {
      const job = await queue.getJob(jobId);
      if (!job) {
        throw createJobNotFoundError(queue.name, jobId);
      }
      await job.remove();
    },
    getWorkerCount: async () => {
      const workers = await getCompatibleWorkers(queue);
      return createWorkerCount(queue.name, workers);
    },
    listWorkers: async () => {
      const prefix = getQueuePrefix(queue);
      const workers = await getCompatibleWorkers(queue);
      return workers.map((worker) =>
        mapRedisClientWorker(worker, queue.name, { prefix, provider: "bullmq" }),
      );
    },
    listFlows: async (options) => listFlows(queue, flowProducer, options),
    getFlow: async (flowId) => getFlow(queue, flowProducer, flowId),
    getJobFlow: async (jobId) => getJobFlow(queue, flowProducer, jobId),
    listJobSchedulers: async (options) => {
      const limit = options?.limit ?? 50;
      const schedulers = await queue.getJobSchedulers(0, limit - 1, true);
      return schedulers.map((scheduler) =>
        mapScheduler(scheduler, queue.name, getQueuePrefix(queue)),
      );
    },
    getJobScheduler: async (target) => {
      const scheduler = await queue.getJobScheduler(target.id ?? target.key);
      return scheduler
        ? mapScheduler(scheduler, queue.name, getQueuePrefix(queue))
        : null;
    },
    upsertJobScheduler: async (input) => {
      await queue.upsertJobScheduler(
        input.schedulerId,
        toRepeatOptions(input.repeat),
        input.template
          ? {
              name: input.template.name,
              data: input.template.data,
              opts: input.template.opts,
            }
          : undefined,
      );
    },
    removeJobScheduler: async (target) => {
      if (target.id) {
        return queue.removeJobScheduler(target.id);
      }
      return queue.removeRepeatableByKey(target.key);
    },
  };
}

function mapScheduler(
  scheduler: JobSchedulerJson,
  queueName: string,
  prefix: string,
): JobScheduler {
  return {
    // For BullMQ job schedulers the `key` is the scheduler id passed to
    // `upsertJobScheduler`; `id` is only the optional job discriminator.
    key: scheduler.key,
    id: scheduler.id ?? scheduler.key,
    name: scheduler.name,
    queueName,
    prefix,
    strategy: scheduler.pattern ? "cron" : "every",
    pattern: scheduler.pattern,
    every: typeof scheduler.every === "number" ? scheduler.every : undefined,
    tz: scheduler.tz,
    next: scheduler.next,
    endDate: scheduler.endDate,
    limit: scheduler.limit,
    template: scheduler.template
      ? {
          data: scheduler.template.data,
          opts: scheduler.template.opts as Record<string, unknown> | undefined,
        }
      : undefined,
  };
}

function toRepeatOptions(
  repeat: JobSchedulerRepeat,
): Omit<RepeatOptions, "key"> {
  const base = {
    tz: repeat.tz,
    endDate: repeat.endDate,
    limit: repeat.limit,
  };

  if (repeat.strategy === "every") {
    return { ...base, every: repeat.every };
  }

  return { ...base, pattern: repeat.pattern };
}

async function listFlows(
  queue: Queue,
  flowProducer: FlowProducer,
  options?: { limit?: number },
): Promise<FlowSummary[]> {
  const limit = options?.limit ?? 50;
  const prefix = getQueuePrefix(queue);
  const flows: FlowSummary[] = [];
  const seenJobIds = new Set<string>();

  const jobs = await getPotentialFlowRoots(queue, limit);

  for (const job of jobs) {
    if (flows.length >= limit) {
      break;
    }
    if (job.parentId) {
      continue;
    }

    const jobKey = `${prefix}:${job.queueName}:${job.id}`;
    if (seenJobIds.has(jobKey)) {
      continue;
    }
    seenJobIds.add(jobKey);

    const flowTree = await getBullMqFlow(flowProducer, {
      id: job.id,
      queueName: job.queueName,
      prefix,
    });

    if (!flowTree?.children || flowTree.children.length === 0) {
      continue;
    }

    const stats = await countFlowStats(flowTree);
    const state = await flowTree.job.getState();

    flows.push({
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      prefix,
      status: state as JobStatus,
      totalJobs: stats.total,
      completedJobs: stats.completed,
      failedJobs: stats.failed,
      timestamp: job.timestamp,
    });
  }

  return flows.sort((a, b) => b.timestamp - a.timestamp);
}

async function getPotentialFlowRoots(
  queue: Queue,
  limit: number,
): Promise<FlowSummaryCandidate[]> {
  const [recentJobs, waitingChildrenJobs] = await Promise.all([
    queue.getJobs(resolveStatuses(undefined), 0, 499),
    queue.getJobs(["waiting-children"], 0, Math.max(limit * 2, 99)),
  ]);

  const jobs = await Promise.all(
    [...recentJobs, ...waitingChildrenJobs]
      .filter((job): job is BullMqJob => job !== undefined)
      .map((job) => mapJob(job, queue.name)),
  );

  return jobs.sort((a, b) => b.timestamp - a.timestamp);
}

async function getFlow(
  queue: Queue,
  flowProducer: FlowProducer,
  flowId: string,
): Promise<FlowTree | null> {
  const flowTree = await getBullMqFlow(flowProducer, {
    id: flowId,
    queueName: queue.name,
    prefix: getQueuePrefix(queue),
  });

  if (!flowTree) {
    return null;
  }

  const root = await convertFlowTree(flowTree);
  const stats = await countFlowStats(flowTree);

  return {
    id: flowId,
    root,
    queueName: queue.name,
    totalNodes: stats.total,
    completedNodes: stats.completed,
    failedNodes: stats.failed,
  };
}

async function getBullMqFlow(
  flowProducer: FlowProducer,
  options: {
    id: string;
    queueName: string;
    prefix: string;
  },
): Promise<JobNode | null> {
  try {
    return await flowProducer.getFlow(options);
  } catch {
    return null;
  }
}

/**
 * Parse a BullMQ parent job key (`<prefix>:<queueName>:<jobId>`) into its
 * components. Prefixes may themselves contain colons, so only the last two
 * segments are treated as the queue name and job id.
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

/**
 * Build the full flow tree a job belongs to. `flowProducer.getFlow` only walks
 * downward to children, so we climb the `parentKey` chain (which can cross
 * queues) to find the flow root before materialising the whole tree.
 */
async function getJobFlow(
  queue: Queue,
  flowProducer: FlowProducer,
  jobId: string,
): Promise<FlowTree | null> {
  const prefix = getQueuePrefix(queue);

  let rootNode = await getBullMqFlow(flowProducer, {
    id: jobId,
    queueName: queue.name,
    prefix,
  });
  if (!rootNode) {
    return null;
  }

  let rootId = jobId;
  let rootQueueName = queue.name;
  let parentKey = rootNode.job.parentKey;

  while (parentKey) {
    const parsed = parseFlowJobKey(parentKey);
    if (!parsed) {
      break;
    }
    const parentNode = await getBullMqFlow(flowProducer, parsed);
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
  const children = tree.children
    ? await Promise.all(tree.children.map((child) => convertFlowTree(child)))
    : [];

  return {
    id: job.id ?? "",
    name: job.name,
    queueName: job.queueName,
    status: state as JobStatus,
    data: job.data,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
    children,
  };
}

type FlowSummaryCandidate = Pick<
  FlowSummary,
  "id" | "name" | "queueName" | "timestamp"
> & {
  parentId?: string;
};

function resolveStatuses(
  status?: JobQueryOptions["filter"] extends infer Filter
    ? Filter extends { status?: infer Status }
      ? Status
      : never
    : never,
): JobType[] {
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

  return (Array.isArray(status) ? status : [status]) as JobType[];
}

function sanitizeJobTypes(types: JobType[] | JobType | undefined): JobType[] {
  const currentTypes = typeof types === "string" ? [types] : types;

  if (Array.isArray(currentTypes) && currentTypes.length > 0) {
    const sanitizedTypes = [...currentTypes];

    if (sanitizedTypes.includes("waiting")) {
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

async function getJobMetaFromKey(
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
  const parentId = parent ? JSON.parse(parent).id : undefined;

  return {
    id: jobId,
    name: name || "",
    queueName: queue.name,
    status: jobStatus as JobStatus,
    timestamp: timestamp ? Number.parseInt(timestamp, 10) : 0,
    progress: progress ? normalizeProgress(progress) : 0,
    attemptsMade: attemptsMade ? Number.parseInt(attemptsMade, 10) : 0,
    processedOn: processedOn ? Number.parseInt(processedOn, 10) : undefined,
    finishedOn: finishedOn ? Number.parseInt(finishedOn, 10) : undefined,
    failedReason: failedReason || undefined,
    delay: delay ? Number.parseInt(delay, 10) : undefined,
    priority: priority ? Number.parseInt(priority, 10) : undefined,
    parentId,
  };
}

async function getJobsTrimmed(
  queue: Queue,
  types?: JobType[],
  start = 0,
  end = -1,
  asc = false,
): Promise<JobSummary[]> {
  if (typeof queue.getRanges !== "function") {
    const jobs = await queue.getJobs(types, start, end, asc);
    const mappedJobs = await Promise.all(
      jobs
        .filter((job): job is BullMqJob => job !== undefined)
        .map((job) => mapJob(job, queue.name)),
    );
    return mappedJobs.map(toJobSummary);
  }

  const jobIds = await queue.getRanges(
    sanitizeJobTypes(types),
    start,
    end,
    asc,
  );
  const jobs = await Promise.all(
    jobIds.map((id) => getJobMetaFromKey(queue, id, queue.toKey(id))),
  );

  return jobs.filter((job): job is JobSummary => job !== null);
}

async function mapJob(job: BullMqJob, queueName: string): Promise<Job> {
  return {
    id: job.id ?? "",
    name: job.name,
    queueName,
    data: job.data,
    status: (await job.getState()) as JobStatus,
    progress: normalizeProgress(job.progress),
    attemptsMade: job.attemptsMade,
    attemptsLimit: job.opts?.attempts ?? 1,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace ?? undefined,
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

function normalizeProgress(progress: number | string | object | boolean) {
  if (typeof progress === "boolean") {
    return progress ? 100 : 0;
  }
  if (typeof progress === "string") {
    const parsed = Number.parseFloat(progress);
    return Number.isNaN(parsed) ? { value: progress } : parsed;
  }
  return progress;
}

async function getJobCounts(queue: Queue) {
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

  return normalizeJobCounts(counts);
}

function getQueuePrefix(queue: Queue): string {
  return queue.opts?.prefix ?? "bull";
}

// Node BullMQ matches workers by base64(queueName); Bull v3 and the Python/other-language
// ports register the plain queue name. Match both so cross-implementation workers are found.
async function getCompatibleWorkers(queue: Queue) {
  const client = await queue.client;
  const list = await client.clientList();
  const prefix = getQueuePrefix(queue);
  const base64 = Buffer.from(queue.name).toString("base64");
  const exact = [`${prefix}:${queue.name}`, `${prefix}:${base64}`];
  const named = exact.map((c) => `${c}:w:`);

  return list
    .split(/\r?\n/)
    .map((line) => {
      const fields: Record<string, string> = {};
      for (const kv of line.split(" ")) {
        const i = kv.indexOf("=");
        if (i !== -1) fields[kv.slice(0, i)] = kv.slice(i + 1);
      }
      return fields;
    })
    .filter((c) => c.name && (exact.includes(c.name) || named.some((p) => c.name.startsWith(p))))
    .map((c) => ({ ...c, rawname: c.name!, name: queue.name }));
}
