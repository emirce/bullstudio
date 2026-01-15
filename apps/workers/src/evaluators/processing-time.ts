import { AlertStatus } from "@bullstudio/prisma";
import type { QueueService } from "@bullstudio/queue";
import type { Job } from "@bullstudio/connect-types";
import type { EvaluationResult, AlertConfig } from "./types";

type ProcessingTimeConfig = {
  threshold: number;
  timeWindowMinutes: number;
  resolveThreshold?: number;
};

export type PercentileType = "avg" | "p95" | "p99";

export async function evaluateProcessingTime(
  config: AlertConfig,
  queueName: string,
  service: QueueService,
  currentStatus: AlertStatus,
  percentile: PercentileType
): Promise<EvaluationResult> {
  const { threshold, timeWindowMinutes, resolveThreshold } =
    config as ProcessingTimeConfig;

  const cutoffTime = Date.now() - timeWindowMinutes * 60 * 1000;

  const completed = await service.getJobs(queueName, {
    filter: { status: "completed" },
    sort: { field: "finishedOn", order: "desc" },
    limit: 1000,
  });

  const recentJobs = completed.filter(
    (j: Job) => j.finishedOn && j.finishedOn >= cutoffTime && j.processedOn
  );

  if (recentJobs.length === 0) {
    return {
      status: AlertStatus.OK,
      value: 0,
      message: `No completed jobs in last ${timeWindowMinutes}min to calculate processing time`,
    };
  }

  const processingTimes = recentJobs
    .map((j: Job) => j.finishedOn! - j.processedOn!)
    .sort((a: number, b: number) => a - b);

  let value: number;
  let label: string;

  if (percentile === "avg") {
    value =
      processingTimes.reduce((sum: number, t: number) => sum + t, 0) / processingTimes.length;
    label = "Average";
  } else if (percentile === "p95") {
    const idx = Math.floor(processingTimes.length * 0.95);
    value = processingTimes[idx] ?? 0;
    label = "P95";
  } else {
    const idx = Math.floor(processingTimes.length * 0.99);
    value = processingTimes[idx] ?? 0;
    label = "P99";
  }

  // Determine status based on current state and thresholds
  let newStatus: AlertStatus;
  if (currentStatus === AlertStatus.OK) {
    newStatus = value > threshold ? AlertStatus.Triggered : AlertStatus.OK;
  } else {
    // Currently triggered - check resolve threshold
    const resolveAt = resolveThreshold ?? threshold;
    newStatus = value <= resolveAt ? AlertStatus.OK : AlertStatus.Triggered;
  }

  return {
    status: newStatus,
    value,
    message: `${label} processing time: ${formatMs(value)} (from ${recentJobs.length} jobs in last ${timeWindowMinutes}min)`,
  };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
