import type { AlertStatus } from "@bullstudio/prisma";
import type { QueueService } from "@bullstudio/queue";

export type EvaluationResult = {
  status: AlertStatus;
  value: number;
  message: string;
};

export type AlertConfig = Record<string, unknown>;

export type Evaluator = (
  config: AlertConfig,
  queueName: string,
  service: QueueService
) => Promise<EvaluationResult>;
