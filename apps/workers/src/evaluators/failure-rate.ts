import { AlertStatus } from "@bullstudio/prisma";
import type { QueueService } from "@bullstudio/queue";
import type { Job } from "@bullstudio/connect-types";
import type { EvaluationResult, AlertConfig } from "./types";

type FailureRateConfig = {
  threshold: number;
  timeWindowMinutes: number;
  resolveThreshold?: number;
};

export async function evaluateFailureRate(
  config: AlertConfig,
  queueName: string,
  service: QueueService,
  currentStatus: AlertStatus
): Promise<EvaluationResult> {
  const { threshold, timeWindowMinutes, resolveThreshold } =
    config as FailureRateConfig;

  const cutoffTime = Date.now() - timeWindowMinutes * 60 * 1000;

  const [completed, failed] = await Promise.all([
    service.getJobs(queueName, {
      filter: { status: "completed" },
      sort: { field: "finishedOn", order: "desc" },
      limit: 1000,
    }),
    service.getJobs(queueName, {
      filter: { status: "failed" },
      sort: { field: "finishedOn", order: "desc" },
      limit: 1000,
    }),
  ]);

  const recentCompleted = completed.filter(
    (j: Job) => j.finishedOn && j.finishedOn >= cutoffTime
  ).length;
  const recentFailed = failed.filter(
    (j: Job) => j.finishedOn && j.finishedOn >= cutoffTime
  ).length;

  const total = recentCompleted + recentFailed;
  const failureRate = total > 0 ? (recentFailed / total) * 100 : 0;

  // Determine status based on current state and thresholds
  let newStatus: AlertStatus;
  if (currentStatus === AlertStatus.OK) {
    newStatus = failureRate > threshold ? AlertStatus.Triggered : AlertStatus.OK;
  } else {
    // Currently triggered - check resolve threshold
    const resolveAt = resolveThreshold ?? threshold;
    newStatus = failureRate <= resolveAt ? AlertStatus.OK : AlertStatus.Triggered;
  }

  return {
    status: newStatus,
    value: failureRate,
    message: `Failure rate: ${failureRate.toFixed(1)}% (${recentFailed}/${total} jobs in last ${timeWindowMinutes}min)`,
  };
}
