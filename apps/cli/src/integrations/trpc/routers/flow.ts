import { type TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";
import { getQueueProvider } from "../connection";
import { FlowProducer, type JobNode } from "bullmq";
import type {
  FlowNode,
  FlowSummary,
  FlowTree,
  JobStatus,
} from "@bullstudio/connect-types";

let flowProducer: FlowProducer | null = null;

async function getFlowProducer(): Promise<FlowProducer> {
  if (!flowProducer) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    flowProducer = new FlowProducer({ connection: { url: redisUrl } });
  }
  return flowProducer;
}

async function countFlowStats(tree: JobNode): Promise<{
  total: number;
  completed: number;
  failed: number;
}> {
  let total = 1;
  let completed = 0;
  let failed = 0;

  const job = tree.job;
  const state = await job.getState();
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
    status: state as JobStatus,
    data: job.data,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason,
    children,
  };
}

export const flowRouter = {
  list: publicProcedure
    .input(
      z.object({ limit: z.number().min(1).max(100).default(50) }).optional(),
    )
    .query(async ({ input }): Promise<FlowSummary[]> => {
      const provider = await getQueueProvider();

      // Check if flows are supported
      const capabilities = provider.getCapabilities();
      if (!capabilities.supportsFlows) {
        return []; // Return empty array for Bull
      }

      const limit = input?.limit ?? 50;
      const fp = await getFlowProducer();
      const queues = await provider.getQueues();

      const flows: FlowSummary[] = [];
      const seenJobIds = new Set<string>();

      for (const queue of queues) {
        if (flows.length >= limit) break;

        const jobs = await provider.getJobsSummary(queue.name, { limit: 500 });

        const potentialRoots = jobs.filter((job) => !job.parentId);

        for (const job of potentialRoots) {
          if (flows.length >= limit) break;

          const jobKey = `${job.queueName}:${job.id}`;
          if (seenJobIds.has(jobKey)) continue;
          seenJobIds.add(jobKey);

          try {
            const flowTree = await fp.getFlow({
              id: job.id,
              queueName: job.queueName,
            });

            if (flowTree?.children && flowTree.children.length > 0) {
              const stats = await countFlowStats(flowTree);
              const state = await flowTree.job.getState();

              flows.push({
                id: job.id,
                name: job.name,
                queueName: job.queueName,
                status: state as JobStatus,
                totalJobs: stats.total,
                completedJobs: stats.completed,
                failedJobs: stats.failed,
                timestamp: job.timestamp,
              });
            }
          } catch {
            // Job might not have a flow, skip
          }
        }
      }

      // Also check jobs with waiting-children status
      for (const queue of queues) {
        if (flows.length >= limit) break;

        const waitingChildrenJobs = await provider.getJobs(queue.name, {
          filter: { status: "waiting-children" },
          limit: 100,
        });

        for (const job of waitingChildrenJobs) {
          if (flows.length >= limit) break;

          const jobKey = `${job.queueName}:${job.id}`;
          if (seenJobIds.has(jobKey)) continue;
          seenJobIds.add(jobKey);

          if (job.parentId) continue; // Skip children

          try {
            const flowTree = await fp.getFlow({
              id: job.id,
              queueName: job.queueName,
            });

            if (flowTree?.children && flowTree.children.length > 0) {
              const stats = await countFlowStats(flowTree);

              flows.push({
                id: job.id,
                name: job.name,
                queueName: job.queueName,
                status: job.status,
                totalJobs: stats.total,
                completedJobs: stats.completed,
                failedJobs: stats.failed,
                timestamp: job.timestamp,
              });
            }
          } catch {
            // Skip
          }
        }
      }

      return flows.sort((a, b) => b.timestamp - a.timestamp);
    }),

  get: publicProcedure
    .input(z.object({ queueName: z.string(), flowId: z.string() }))
    .query(async ({ input }): Promise<FlowTree> => {
      const provider = await getQueueProvider();

      // Check if flows are supported
      const capabilities = provider.getCapabilities();
      if (!capabilities.supportsFlows) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Flows are not supported by this queue provider (Bull)",
        });
      }

      const fp = await getFlowProducer();

      try {
        const flowTree = await fp.getFlow({
          id: input.flowId,
          queueName: input.queueName,
        });

        if (!flowTree) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Flow ${input.flowId} not found in queue ${input.queueName}`,
          });
        }

        const root = await convertFlowTree(flowTree);
        const stats = await countFlowStats(flowTree);

        return {
          id: input.flowId,
          root,
          queueName: input.queueName,
          totalNodes: stats.total,
          completedNodes: stats.completed,
          failedNodes: stats.failed,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Flow ${input.flowId} not found in queue ${input.queueName}`,
        });
      }
    }),
} satisfies TRPCRouterRecord;
