import { AlertType, AlertStatus } from "@bullstudio/prisma";
import type { QueueService } from "@bullstudio/queue";
import { evaluateFailureRate } from "./failure-rate";
import { evaluateBacklog } from "./backlog";
import { evaluateProcessingTime } from "./processing-time";
import { evaluateMissingWorkers } from "./missing-workers";
import type { EvaluationResult, AlertConfig } from "./types";

export type { EvaluationResult, AlertConfig };

export async function evaluateAlert(
  type: AlertType,
  config: AlertConfig,
  queueName: string,
  service: QueueService,
  currentStatus: AlertStatus
): Promise<EvaluationResult> {
  switch (type) {
    case AlertType.FailureRate:
      return evaluateFailureRate(config, queueName, service, currentStatus);

    case AlertType.BacklogExceeded:
      return evaluateBacklog(config, queueName, service, currentStatus);

    case AlertType.ProcessingTimeAvg:
      return evaluateProcessingTime(
        config,
        queueName,
        service,
        currentStatus,
        "avg"
      );

    case AlertType.ProcessingTimeP95:
      return evaluateProcessingTime(
        config,
        queueName,
        service,
        currentStatus,
        "p95"
      );

    case AlertType.ProcessingTimeP99:
      return evaluateProcessingTime(
        config,
        queueName,
        service,
        currentStatus,
        "p99"
      );

    case AlertType.MissingWorkers:
      return evaluateMissingWorkers(config, queueName, service, currentStatus);

    default:
      throw new Error(`Unknown alert type: ${type}`);
  }
}
