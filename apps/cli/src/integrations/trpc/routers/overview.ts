import { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";
import { getQueueProvider } from "../connection";
import type { JobSummary } from "@bullstudio/connect-types";

export type TimeSeriesDataPoint = {
  timestamp: number;
  completed: number;
  failed: number;
  avgProcessingTimeMs: number;
  avgDelayMs: number;
};

export type SlowJob = {
  id: string;
  name: string;
  queueName: string;
  processingTimeMs: number;
  timestamp: number;
  status: string;
};

export type FailingJobType = {
  name: string;
  queueName: string;
  failureCount: number;
  lastFailedAt: number;
  lastFailedReason?: string;
};

export type OverviewMetricsResponse = {
  summary: {
    totalCompleted: number;
    totalFailed: number;
    avgThroughputPerHour: number;
    failureRate: number;
    avgProcessingTimeMs: number;
    avgDelayMs: number;
  };
  timeSeries: TimeSeriesDataPoint[];
  slowestJobs: SlowJob[];
  failingJobTypes: FailingJobType[];
  queuesCount: number;
  lastUpdated: number;
};

function aggregateMetrics(
  jobs: JobSummary[],
  timeRangeHours: number,
  queuesCount: number
): OverviewMetricsResponse {
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const failedJobs = jobs.filter((j) => j.status === "failed");

  const jobsWithProcessingTime = jobs.filter(
    (j) => j.processedOn && j.finishedOn
  );
  const avgProcessingTimeMs =
    jobsWithProcessingTime.length > 0
      ? jobsWithProcessingTime.reduce(
          (sum, j) => sum + (j.finishedOn! - j.processedOn!),
          0
        ) / jobsWithProcessingTime.length
      : 0;

  const jobsWithDelay = jobs.filter((j) => j.processedOn && j.timestamp);
  const avgDelayMs =
    jobsWithDelay.length > 0
      ? jobsWithDelay.reduce(
          (sum, j) => sum + (j.processedOn! - j.timestamp - (j.delay || 0)),
          0
        ) / jobsWithDelay.length
      : 0;

  const timeSeries = buildTimeSeries(jobs, timeRangeHours);
  const slowestJobs = buildSlowestJobs(jobsWithProcessingTime);
  const failingJobTypes = buildFailingJobTypes(failedJobs);

  const totalJobs = completedJobs.length + failedJobs.length;

  return {
    summary: {
      totalCompleted: completedJobs.length,
      totalFailed: failedJobs.length,
      avgThroughputPerHour: totalJobs / timeRangeHours,
      failureRate: totalJobs > 0 ? (failedJobs.length / totalJobs) * 100 : 0,
      avgProcessingTimeMs,
      avgDelayMs: Math.max(0, avgDelayMs),
    },
    timeSeries,
    slowestJobs,
    failingJobTypes,
    queuesCount,
    lastUpdated: Date.now(),
  };
}

function buildTimeSeries(
  jobs: JobSummary[],
  timeRangeHours: number
): TimeSeriesDataPoint[] {
  const hourlyBuckets = new Map<number, JobSummary[]>();
  const now = Date.now();

  for (let i = 0; i < timeRangeHours; i++) {
    const bucketTime = now - i * 60 * 60 * 1000;
    const hourStart =
      Math.floor(bucketTime / (60 * 60 * 1000)) * (60 * 60 * 1000);
    hourlyBuckets.set(hourStart, []);
  }

  for (const job of jobs) {
    if (job.finishedOn) {
      const hourStart =
        Math.floor(job.finishedOn / (60 * 60 * 1000)) * (60 * 60 * 1000);
      const bucket = hourlyBuckets.get(hourStart);
      if (bucket) bucket.push(job);
    }
  }

  return Array.from(hourlyBuckets.entries())
    .map(([timestamp, bucketJobs]) => {
      const completed = bucketJobs.filter(
        (j) => j.status === "completed"
      ).length;
      const failed = bucketJobs.filter((j) => j.status === "failed").length;
      const withTimes = bucketJobs.filter((j) => j.processedOn && j.finishedOn);
      const withDelay = bucketJobs.filter((j) => j.processedOn);

      return {
        timestamp,
        completed,
        failed,
        avgProcessingTimeMs:
          withTimes.length > 0
            ? withTimes.reduce(
                (s, j) => s + (j.finishedOn! - j.processedOn!),
                0
              ) / withTimes.length
            : 0,
        avgDelayMs:
          withDelay.length > 0
            ? Math.max(
                0,
                withDelay.reduce(
                  (s, j) =>
                    s + (j.processedOn! - j.timestamp - (j.delay || 0)),
                  0
                ) / withDelay.length
              )
            : 0,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function buildSlowestJobs(jobs: JobSummary[]): SlowJob[] {
  return jobs
    .map((job) => ({
      id: job.id,
      name: job.name,
      queueName: job.queueName,
      processingTimeMs: job.finishedOn! - job.processedOn!,
      timestamp: job.timestamp,
      status: job.status,
    }))
    .sort((a, b) => b.processingTimeMs - a.processingTimeMs)
    .slice(0, 10);
}

function buildFailingJobTypes(failedJobs: JobSummary[]): FailingJobType[] {
  const grouped = new Map<string, JobSummary[]>();

  for (const job of failedJobs) {
    const key = `${job.queueName}:${job.name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(job);
  }

  return Array.from(grouped.entries())
    .map(([key, jobs]) => {
      const parts = key.split(":");
      const queueName = parts[0] ?? "";
      const name = parts.slice(1).join(":");
      const sorted = jobs.sort(
        (a, b) => (b.finishedOn || 0) - (a.finishedOn || 0)
      );
      const latest = sorted[0];

      return {
        name,
        queueName,
        failureCount: jobs.length,
        lastFailedAt: latest?.finishedOn || latest?.timestamp || 0,
        lastFailedReason: latest?.failedReason,
      };
    })
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 10);
}

export const overviewRouter = {
  metrics: publicProcedure
    .input(
      z.object({
        queueName: z.string().optional(),
        timeRangeHours: z.number().min(1).max(168).default(24),
      })
    )
    .query(async ({ input }): Promise<OverviewMetricsResponse> => {
      const provider = await getQueueProvider();
      const allQueues = await provider.getQueues();
      const timeRangeMs = input.timeRangeHours * 60 * 60 * 1000;
      const cutoffTimestamp = Date.now() - timeRangeMs;

      const queuesToProcess = input.queueName
        ? allQueues.filter((q) => q.name === input.queueName)
        : allQueues;

      const allJobs: JobSummary[] = [];

      for (const queue of queuesToProcess) {
        const [completed, failed] = await Promise.all([
          provider.getJobsSummary(queue.name, {
            filter: { status: "completed" },
            limit: 1000,
          }),
          provider.getJobsSummary(queue.name, {
            filter: { status: "failed" },
            limit: 1000,
          }),
        ]);

        allJobs.push(
          ...completed.filter(
            (j) => j.finishedOn && j.finishedOn >= cutoffTimestamp
          ),
          ...failed.filter(
            (j) => j.finishedOn && j.finishedOn >= cutoffTimestamp
          )
        );
      }

      return aggregateMetrics(
        allJobs,
        input.timeRangeHours,
        queuesToProcess.length
      );
    }),
} satisfies TRPCRouterRecord;
