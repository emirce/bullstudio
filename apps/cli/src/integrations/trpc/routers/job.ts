import { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";
import { getQueueProvider } from "../connection";
import type { Job } from "@bullstudio/connect-types";

const jobStatusSchema = z.enum([
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
  "paused",
  "waiting-children",
]);

export const jobRouter = {
  list: publicProcedure
    .input(
      z
        .object({
          queueName: z.string().optional(),
          status: jobStatusSchema.optional(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input }): Promise<Job[]> => {
      const provider = await getQueueProvider();
      const queues = await provider.getQueues();

      const queuesToFetch = input?.queueName
        ? queues.filter((q) => q.name === input.queueName)
        : queues;

      const allJobs: Job[] = [];
      for (const queue of queuesToFetch) {
        const jobs = await provider.getJobs(queue.name, {
          filter: input?.status ? { status: input.status } : undefined,
          limit: input?.limit ?? 100,
          offset: input?.offset ?? 0,
        });
        allJobs.push(...jobs);
      }

      // Sort by timestamp descending
      return allJobs.sort((a, b) => b.timestamp - a.timestamp);
    }),

  get: publicProcedure
    .input(z.object({ queueName: z.string(), jobId: z.string() }))
    .query(async ({ input }): Promise<Job | null> => {
      const provider = await getQueueProvider();
      return provider.getJob(input.queueName, input.jobId);
    }),

  retry: publicProcedure
    .input(z.object({ queueName: z.string(), jobId: z.string() }))
    .mutation(async ({ input }) => {
      const provider = await getQueueProvider();

      // First check if the job exists and is in a failed state
      const job = await provider.getJob(input.queueName, input.jobId);
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Job ${input.jobId} not found in queue ${input.queueName}`,
        });
      }

      if (job.status !== "failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job is not in failed state. Current status: ${job.status}`,
        });
      }

      // Check if there are workers available to process the job
      const workerCount = await provider.getWorkerCount(input.queueName);
      if (workerCount.count === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No workers available for queue "${input.queueName}". Start a worker to process retried jobs.`,
        });
      }

      // Retry the job
      await provider.retryJob(input.queueName, input.jobId);

      return {
        success: true,
        message: `Job "${job.name}" has been enqueued for retry`,
        workerCount: workerCount.count,
      };
    }),

  remove: publicProcedure
    .input(z.object({ queueName: z.string(), jobId: z.string() }))
    .mutation(async ({ input }) => {
      const provider = await getQueueProvider();

      // Check if job exists
      const job = await provider.getJob(input.queueName, input.jobId);
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Job ${input.jobId} not found in queue ${input.queueName}`,
        });
      }

      await provider.removeJob(input.queueName, input.jobId);

      return {
        success: true,
        message: `Job "${job.name}" has been removed`,
      };
    }),
} satisfies TRPCRouterRecord;
