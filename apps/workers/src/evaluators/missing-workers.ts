import { AlertStatus } from "@bullstudio/prisma";
import type { QueueService } from "@bullstudio/queue";
import type { EvaluationResult, AlertConfig } from "./types";

type MissingWorkersConfig = {
  gracePeriodMinutes?: number;
};

export async function evaluateMissingWorkers(
  config: AlertConfig,
  queueName: string,
  service: QueueService,
  currentStatus: AlertStatus
): Promise<EvaluationResult> {
  const workerCount = await service.getWorkerCount(queueName);

  const newStatus =
    workerCount.count === 0 ? AlertStatus.Triggered : AlertStatus.OK;

  return {
    status: newStatus,
    value: workerCount.count,
    message:
      workerCount.count === 0
        ? `No workers detected for queue "${queueName}"`
        : `${workerCount.count} worker(s) active`,
  };
}
