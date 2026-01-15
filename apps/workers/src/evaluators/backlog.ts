import { AlertStatus } from "@bullstudio/prisma";
import type { QueueService } from "@bullstudio/queue";
import type { EvaluationResult, AlertConfig } from "./types";

type BacklogConfig = {
  threshold: number;
  resolveThreshold?: number;
};

export async function evaluateBacklog(
  config: AlertConfig,
  queueName: string,
  service: QueueService,
  currentStatus: AlertStatus
): Promise<EvaluationResult> {
  const { threshold, resolveThreshold } = config as BacklogConfig;

  const jobCounts = await service.getJobCounts(queueName);
  const backlog = jobCounts.waiting + jobCounts.delayed;

  // Determine status based on current state and thresholds
  let newStatus: AlertStatus;
  if (currentStatus === AlertStatus.OK) {
    newStatus = backlog > threshold ? AlertStatus.Triggered : AlertStatus.OK;
  } else {
    // Currently triggered - check resolve threshold
    const resolveAt = resolveThreshold ?? threshold;
    newStatus = backlog <= resolveAt ? AlertStatus.OK : AlertStatus.Triggered;
  }

  return {
    status: newStatus,
    value: backlog,
    message: `Backlog: ${backlog} jobs (waiting: ${jobCounts.waiting}, delayed: ${jobCounts.delayed})`,
  };
}
